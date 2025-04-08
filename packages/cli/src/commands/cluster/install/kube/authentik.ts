import { findFolder } from "../../../../util/findFolder";
import { getDelegatedZonesFolderPaths } from "../../../../util/getDelegatedZonesFolderPaths";
import { getRepoVariables } from "../../../../util/scripts/get-repo-variables";
import { getTerragruntVariables } from "../../../../util/scripts/get-terragrunt-variables";
import { writeErrorToDebugFile } from "../../../../util/write-error-to-debug-file";
import type { BaseContext } from "clipanion";
import { confirm, input, password, select } from "@inquirer/prompts";
import pc from "picocolors";
import { readdir } from "fs/promises";
import path from "path";
import { ensureFileExists } from "../../../../util/ensure-file-exists";
import kubeSesDomainTerragruntHcl from "../../../../templates/aws_ses_domain_terragrunt.hcl" with { type: "file" };
import { replaceHclValue } from "../../../../util/replace-hcl-value";
import { initAndApplyModule } from "../../../../util/init-and-apply-module";
import { checkStepCompletion } from "../../../../util/check-step-completion";
import { updateConfigFile } from "../../../../util/update-config-file";
import { getConfigFileKey } from "../../../../util/get-config-file-key";
import kubeAuthentikTerragruntHcl from "../../../../templates/kube_authentik_terragrunt.hcl" with { type: "file" };
import { getModuleOutputs } from "../../../../util/scripts/helpers/terragrunt/get-module-outputs";
import { z } from "zod";
import { replaceYamlValue } from "../../../../util/replace-yaml-value";
import authentikCoreResourcesTerragruntHcl from "../../../../templates/authentik_core_resources_terragrunt.hcl" with { type: "file" };
import { appendFile } from "fs/promises";

const paginationSchema = z.object({
  next: z.number(),
  previous: z.number(),
  count: z.number(),
  current: z.number(),
  total_pages: z.number(),
  start_index: z.number(),
  end_index: z.number(),
});

export const setupAuthentik = async ({
  configPath,
  context,
  verbose = false,
}: {
  configPath: string;
  context: BaseContext;
  verbose?: boolean;
}) => {
  // See if kube_authentik/terragrunt.hcl exist somewhere
  const repoVariables = await getRepoVariables({
    context,
  });
  const terragruntVariables = await getTerragruntVariables({ context });
  const repoRoot = repoVariables.repo_root;

  // Search for kube_authentik folder
  let kubeAuthentikPath = null;
  if (verbose) {
    context.stdout.write(
      `Searching for kube_authentik folder in ${repoRoot}...\n`
    );
  }

  try {
    kubeAuthentikPath = await findFolder(repoRoot, "kube_authentik");
  } catch (error) {
    writeErrorToDebugFile({
      context,
      error,
    });
    throw new Error("Errored while trying to find kube_authentik folder");
  }

  if (!kubeAuthentikPath) {
    let awsSesDomainSetupComplete = false;
    try {
      awsSesDomainSetupComplete = await checkStepCompletion({
        configFilePath: configPath,
        context,
        step: "awsSesDomainSetup",
        stepCompleteMessage:
          "14.a. Skipping AWS SES domain setup as it's already complete.\n",
        stepNotCompleteMessage: "14.a. Setting up AWS SES domain\n",
      });
    } catch {
      throw new Error("Failed to check if AWS SES domain setup is complete");
    }
    if (!awsSesDomainSetupComplete) {
      // https://panfactum.com/docs/edge/guides/bootstrapping/identity-provider#configure-aws-ses
      // Will be refactored soon with new DNS structure so this whole bit of logic will be changed
      // Figure out if this is the production environment, if not where that is to write the files
      const delegatedZonesFolders = await getDelegatedZonesFolderPaths({
        environmentDir: repoVariables.environments_dir,
        context,
        verbose,
      });

      const delegatedZoneForCurrentEnvironment = delegatedZonesFolders.find(
        (folder) =>
          folder.folderName ===
          `aws_delegated_zones_${terragruntVariables.environment}`
      );

      const productionEnvironmentName = delegatedZoneForCurrentEnvironment!.path
        .split("/")
        .slice(0, -1)
        .join("/");

      const isProductionEnvironment = productionEnvironmentName.includes(
        terragruntVariables.environment
      );

      // Ask if they want to install Authentik, if they're not in the prod environment let them know they must have access to the prod environment to install it
      const confirmInstall = await confirm({
        message: pc.magenta(
          `Do you want to install Authentik? ${
            isProductionEnvironment
              ? ""
              : "You must have access to the production environment to install Authentik."
          }`
        ),
        default: true,
      });

      // If they say no, rebuke and confirm
      if (!confirmInstall) {
        const confirmExit = await confirm({
          message: pc.magenta(
            `We ${pc.bold("STRONGLY")} recommend completing this step if possible.\nAre you sure you want to exit?`
          ),
          default: false,
        });
        // If they still say no, exit with zero exit code.
        if (confirmExit) {
          return 0;
        }
      }

      // Get the top level folders in the prod environment
      // Ask the user which one to install Authentik to, not global
      const prodEnvironmentFolders: string[] = [];
      const productionEnvironmentDelegatedZonePath = delegatedZonesFolders.find(
        (folderInfo) => folderInfo.path.includes(productionEnvironmentName)
      );
      if (!productionEnvironmentDelegatedZonePath) {
        throw new Error("Production environment path not found");
      }
      const productionEnvironmentFolders = await readdir(
        productionEnvironmentDelegatedZonePath.path
          .split("/")
          .slice(0, -1)
          .join("/"),
        { withFileTypes: true }
      );
      productionEnvironmentFolders.map((folder) => {
        if (folder.isDirectory() && folder.name !== "global") {
          prodEnvironmentFolders.push(folder.name);
        }
      });

      if (prodEnvironmentFolders.length === 0) {
        throw new Error(
          "No environment folders found in production environment"
        );
      }

      const selectedCluster = await select({
        message: pc.magenta(
          "Which cluster do you want to install Authentik to?"
        ),
        choices: prodEnvironmentFolders.map((folder) => ({
          name: folder,
          value: folder,
        })),
      });

      // Get the domain to use for SES
      const domain = await input({
        message: pc.magenta(
          "Which domain do you want to use for e-mails from Authentic?"
        ),
        validate: (input) => {
          const regex =
            /^((?!-))(xn--)?[a-z0-9][a-z0-9-_]{0,61}[a-z0-9]{0,1}\.(xn--)?([a-z0-9\-]{1,61}|[a-z0-9-]{1,30}\.[a-z]{2,})$/;
          return regex.test(input) ? true : "Please enter a valid domain";
        },
        required: true,
      });

      const authentikClusterPath = path.join(
        repoVariables.environments_dir,
        productionEnvironmentName,
        selectedCluster
      );

      await ensureFileExists({
        context,
        destinationFile: path.join(
          authentikClusterPath,
          "kube_ses_domain",
          "terragrunt.hcl"
        ),
        sourceFile: await Bun.file(kubeSesDomainTerragruntHcl).text(),
      });

      await replaceHclValue(
        "./kube_ses_domain/terragrunt.hcl",
        "inputs.domain",
        domain
      );

      await initAndApplyModule({
        context,
        moduleName: "SES Domain",
        modulePath: "./kube_ses_domain",
        verbose,
      });

      await updateConfigFile({
        updates: {
          authentikClusterPath,
          awsSesDomainSetup: true,
          awsSesDomain: domain,
        },
        configPath,
        context,
      });
    }

    // https://panfactum.com/docs/edge/guides/bootstrapping/identity-provider#deploy-authentik
    let authentikSetupComplete = false;
    try {
      authentikSetupComplete = await checkStepCompletion({
        configFilePath: configPath,
        context,
        step: "authentikSetup",
        stepCompleteMessage:
          "14.b. Skipping Authentik setup as it's already complete.\n",
        stepNotCompleteMessage: "14.b. Setting up Authentik\n",
      });
    } catch {
      throw new Error("Failed to check if Authentik setup is complete");
    }
    if (!authentikSetupComplete) {
      const domainFromConfig = await getConfigFileKey({
        configPath,
        context,
        key: "awsSesDomain",
      });
      const emailFromConfig = await getConfigFileKey({
        configPath,
        context,
        key: "alertEmail",
      });
      const authentikClusterPath = await getConfigFileKey({
        configPath,
        context,
        key: "authentikClusterPath",
      });

      if (!authentikClusterPath || typeof authentikClusterPath !== "string") {
        throw new Error("Authentik cluster path not found in setup file.");
      }

      let userInputDomain = "";
      let userInputEmail = "";

      if (!domainFromConfig || typeof domainFromConfig !== "string") {
        userInputDomain = await input({
          message: pc.magenta(
            "Which subdomain do you want to use for Authentic?"
          ),
          validate: (input) => {
            const regex =
              /^((?!-))(xn--)?[a-z0-9][a-z0-9-_]{0,61}[a-z0-9]{0,1}\.(xn--)?([a-z0-9\-]{1,61}|[a-z0-9-]{1,30}\.[a-z]{2,})$/;
            return regex.test(input) ? true : "Please enter a valid domain";
          },
          default: "authentik.<yourcompany>.com",
          required: true,
        });
      }
      if (!emailFromConfig || typeof emailFromConfig !== "string") {
        userInputEmail = await input({
          message: pc.magenta(
            "Which email do you want to use for the initial root authentik user?"
          ),
          validate: (value) => {
            // From https://emailregex.com/
            const emailRegex =
              /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
            if (!emailRegex.test(value.trim())) {
              return "Please enter a valid email address";
            }
            return true;
          },
        });
      }

      const domain = domainFromConfig || userInputDomain;
      const email = emailFromConfig || userInputEmail;

      await ensureFileExists({
        context,
        destinationFile: path.join(
          authentikClusterPath,
          "kube_authentik",
          "terragrunt.hcl"
        ),
        sourceFile: await Bun.file(kubeAuthentikTerragruntHcl).text(),
      });

      await replaceHclValue(
        path.join(authentikClusterPath, "./kube_authentik/terragrunt.hcl"),
        "inputs.domain",
        domain as string
      );

      await replaceHclValue(
        path.join(authentikClusterPath, "./kube_authentik/terragrunt.hcl"),
        "inputs.akadmin_email",
        email as string
      );

      await initAndApplyModule({
        context,
        moduleName: "Authentik",
        modulePath: path.join(authentikClusterPath, "./kube_authentik"),
        verbose,
      });

      const outputs = getModuleOutputs({
        context,
        modulePath: path.join(authentikClusterPath, "./kube_authentik"),
        verbose,
        validationSchema: z.record(
          z.string(),
          z.object({
            sensitive: z.boolean(),
            type: z.any(),
            value: z.string(),
          })
        ),
      });

      if (!outputs["akadmin_bootstrap_token"]) {
        throw new Error(
          "akadmin_bootstrap_token not found in Authentik module outputs"
        );
      }

      const authentikBrandsResponse = await Bun.fetch(
        `https://${domain}/api/v3/core/brands/`,
        {
          headers: {
            Authorization: `Bearer ${outputs["akadmin_bootstrap_token"].value}`,
            Accept: "application/json",
          },
        }
      );
      const authentikBrands = await authentikBrandsResponse.json();
      const brandsSchema = z.object({
        pagination: paginationSchema,
        results: z.array(
          z.object({
            brand_uuid: z.string(),
            domain: z.string(),
            default: z.boolean(),
            branding_title: z.string().optional(),
            branding_logo: z.string().optional(),
            branding_favicon: z.string().optional(),
            flow_authentication: z.string().nullable(),
            flow_invalidation: z.string().nullable(),
            flow_recovery: z.string().nullable(),
            flow_unenrollment: z.string().nullable(),
            flow_user_settings: z.string().nullable(),
            flow_device_code: z.string().nullable(),
            default_application: z.string().nullable(),
            web_certificate: z.string().nullable(),
            attributes: z.any(),
          })
        ),
      });
      const authentikBrandsValidated = brandsSchema.parse(authentikBrands);
      const authentikDefaultBrand = authentikBrandsValidated.results.find(
        (brand) => brand.domain === "authentik-default"
      );
      if (authentikDefaultBrand) {
        await Bun.fetch(
          `https://${domain}/api/v3/core/brands/${authentikDefaultBrand.brand_uuid}/`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${outputs["akadmin_bootstrap_token"].value}`,
            },
            body: JSON.stringify({
              ...authentikBrandsValidated,
              default: false,
            }),
          }
        );
      }

      await ensureFileExists({
        context,
        destinationFile: path.join(
          repoVariables.environments_dir,
          "global.yaml"
        ),
        sourceFile: await Bun.file("").text(),
      });

      await replaceYamlValue(
        path.join(repoVariables.environments_dir, "global.yaml"),
        "authentik_url",
        `https://${domain}`
      );

      await updateConfigFile({
        updates: {
          authentikSetup: true,
          akadminBootstrapToken: outputs["akadmin_bootstrap_token"].value,
          authentikDomain: domain,
          authentikEmail: email,
        },
        configPath,
        context,
      });
    }

    // https://panfactum.com/docs/edge/guides/bootstrapping/identity-provider#configure-authentik---automated-set-up
    let configureAuthentikComplete = false;
    try {
      configureAuthentikComplete = await checkStepCompletion({
        configFilePath: configPath,
        context,
        step: "configureAuthentik",
        stepCompleteMessage:
          "14.c. Skipping Authentik configuration as it's already complete.\n",
        stepNotCompleteMessage: "14.c. Configuring Authentik\n",
      });
    } catch {
      throw new Error("Failed to check if Authentik setup is complete");
    }
    if (!configureAuthentikComplete) {
      const authentikClusterPath = await getConfigFileKey({
        configPath,
        context,
        key: "authentikClusterPath",
      });

      const authentikDomain = await getConfigFileKey({
        configPath,
        context,
        key: "authentikDomain",
      });

      if (!authentikDomain || typeof authentikDomain !== "string") {
        throw new Error("Authentik domain not found in setup file.");
      }

      if (!authentikClusterPath || typeof authentikClusterPath !== "string") {
        throw new Error("Authentik cluster path not found in setup file.");
      }

      const orgName = await input({
        message: pc.magenta(
          "How you want your organization to be referenced on the Authentik web UI?"
        ),
        required: true,
      });

      const domainParts = authentikDomain.split(".");
      const baseDomain =
        domainParts.length >= 2
          ? domainParts.slice(-2).join(".")
          : authentikDomain;

      await ensureFileExists({
        context,
        destinationFile: path.join(
          authentikClusterPath,
          "authentik_core_resources/terragrunt.hcl"
        ),
        sourceFile: await Bun.file(authentikCoreResourcesTerragruntHcl).text(),
      });

      await replaceHclValue(
        path.join(
          authentikClusterPath,
          "authentik_core_resources/terragrunt.hcl"
        ),
        "inputs.organization_name",
        orgName
      );

      await replaceHclValue(
        path.join(
          authentikClusterPath,
          "authentik_core_resources/terragrunt.hcl"
        ),
        "inputs.organization_domain",
        baseDomain
      );

      await initAndApplyModule({
        context,
        moduleName: "Authentik Core Resources",
        modulePath: path.join(authentikClusterPath, "authentik_core_resources"),
        verbose,
      });

      await updateConfigFile({
        updates: {
          configureAuthentik: true,
        },
        configPath,
        context,
      });
    }

    // https://panfactum.com/docs/edge/guides/bootstrapping/identity-provider#provision-your-user
    let provisionUserComplete = false;
    try {
      provisionUserComplete = await checkStepCompletion({
        configFilePath: configPath,
        context,
        step: "provisionUser",
        stepCompleteMessage:
          "14.d. Skipping Authentik user provisioning as it's already complete.\n",
        stepNotCompleteMessage: "14.d. Provisioning Authentik user\n",
      });
    } catch {
      throw new Error(
        "Failed to check if Authentik user provisioning is complete"
      );
    }
    if (!provisionUserComplete) {
      context.stdout.write(
        pc.blue("We will now setup your user in Authentik\n")
      );
      const authentikDomain = await getConfigFileKey({
        configPath,
        context,
        key: "authentikDomain",
      });
      const akadminBootstrapToken = await getConfigFileKey({
        configPath,
        context,
        key: "akadminBootstrapToken",
      });
      const authentikEmail = await getConfigFileKey({
        configPath,
        context,
        key: "authentikEmail",
      });

      if (!authentikEmail || typeof authentikEmail !== "string") {
        throw new Error("Authentik email not found in setup file.");
      }
      if (!authentikDomain || typeof authentikDomain !== "string") {
        throw new Error("Authentik domain not found in setup file.");
      }
      if (!akadminBootstrapToken || typeof akadminBootstrapToken !== "string") {
        throw new Error("Bootstrap token not found in setup file.");
      }
      const authentikUrl = `https://${authentikDomain}`;

      const username = await input({
        message: pc.magenta(
          "What email would you like to use for your Authentik user?"
        ),
        required: true,
        validate: (input) => {
          // From https://emailregex.com/
          const emailRegex =
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
          if (!emailRegex.test(input.trim())) {
            return "Please enter a valid email address";
          }
          return true;
        },
      });

      const name = await input({
        message: pc.magenta("What's your name for your Authentik user?"),
        required: true,
      });

      // get superusers group uuid
      // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-groups-list
      const groupsResponse = await Bun.fetch(
        `${authentikUrl}/api/v3/core/groups/`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${akadminBootstrapToken}`,
          },
        }
      );
      if (groupsResponse.status !== 200) {
        throw new Error("Failed to get groups in Authentik");
      }
      const groups = await groupsResponse.json();
      const groupsSchema = z.object({
        pagination: paginationSchema,
        results: z.array(
          z.object({
            pk: z.string(),
            num_pk: z.number(),
            name: z.string(),
            is_superuser: z.boolean(),
            parent: z.string().nullable(),
            parent_name: z.string().nullable(),
            users: z.array(z.number()),
            users_obj: z.array(
              z.object({
                pk: z.number(),
                username: z.string(),
                name: z.string(),
                is_active: z.boolean(),
                last_login: z.string().nullable(),
                email: z.string(),
                attributes: z.any(),
                uid: z.string(),
              })
            ),
            attributes: z.any(),
            roles: z.array(z.string()),
            roles_obj: z.array(z.object({ pk: z.string(), name: z.string() })),
          })
        ),
      });
      const groupsValidated = groupsSchema.parse(groups);
      const superusersGroup = groupsValidated.results.find(
        (group) => group.name === "superusers"
      );
      if (!superusersGroup) {
        throw new Error("Superusers group not found in Authentik");
      }
      const superusersGroupUuid = superusersGroup.pk;

      // create the user via API
      // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-create
      const createUserResponse = await Bun.fetch(
        `${authentikUrl}/api/v3/core/users/`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${akadminBootstrapToken}`,
          },
          body: JSON.stringify({
            username: username,
            name: name,
            email: username,
            is_active: true,
            groups: [superusersGroupUuid],
            path: "users",
            type: "internal",
            attributes: {},
          }),
        }
      );

      if (createUserResponse.status !== 201) {
        throw new Error("Failed to create user in Authentik");
      }
      const user = (await createUserResponse.json()) as { pk: number };
      const userId = user.pk;

      // get the password reset link and provide it to the user
      const passwordResetResponse = await Bun.fetch(
        `${authentikUrl}/api/v3/core/users/${userId}/recovery/`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${akadminBootstrapToken}`,
          },
        }
      );
      if (passwordResetResponse.status !== 200) {
        throw new Error("Failed to get password reset link in Authentik");
      }
      const passwordReset = (await passwordResetResponse.json()) as {
        link: string;
      };
      const passwordResetLink = passwordReset.link;

      // create the API token
      const createTokenResponse = await Bun.fetch(
        `${authentikUrl}/api/v3/core/tokens/`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${akadminBootstrapToken}`,
          },
          body: JSON.stringify({
            managed: null,
            identifier: "local-framework-token",
            intent: "api",
            user: userId,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            expiring: true,
            description:
              "Created while running the Panfactum CLI and used to interact with Authentik from the local machine.",
          }),
        }
      );

      if (createTokenResponse.status !== 201) {
        throw new Error("Failed to create API token in Authentik");
      }
      const token = (await createTokenResponse.json()) as { pk: string };
      const userTokenPk = token.pk;

      context.stdout.write(
        pc.blue(
          `Go ahead and setup your account\nWhen you're done don't exit the web browser\nWe will need some info to continue\nUse this link to setup your account:\n${passwordResetLink}\n`
        )
      );

      const accountSetupComplete = await confirm({
        message: pc.magenta(
          "Have you setup your Authentik account?\nYou must complete that before continuing."
        ),
        default: true,
      });

      if (!accountSetupComplete) {
        const accountSetupCompleteAgain = await confirm({
          message: pc.magenta(
            "Have you setup your Authentik account?\nYou must complete that before continuing."
          ),
          default: true,
        });
        if (!accountSetupCompleteAgain) {
          context.stdout.write(
            pc.red(
              "You must complete the account setup before continuing.\nExiting...\n"
            )
          );
          return 0;
        }
      }

      // replace bootstrap token with API token
      const newToken = await password({
        message: pc.magenta(
          "We have created a new temporary API token to use\n" +
            `Go to https://${authentikDomain}/if/user/#/settings;%7B%22page%22%3A%22page-tokens%22%7D\n` +
            "Look for the token with the identifier 'local-framework-token'\n" +
            "Copy the token and paste it here:"
        ),
        validate: async (value) => {
          try {
            const proc = Bun.spawnSync([
              "curl",
              "-s",
              "-H",
              `Authorization: Bearer ${value}`,
              `${authentikUrl}/api/v3/core/groups/`,
              "-w",
              "'%{http_code}'",
              "-o",
              "/dev/null",
            ]);
            const result = proc.stdout.toString().trim().replace("%", "");
            if (result !== "200") {
              return "This does not appear to be a valid Docker Hub Access Token or the permissions are not correct";
            }
            return true;
          } catch {
            return "Error validating Docker Hub Access Token, please try again.";
          }
        },
      });

      // Add AUTHENTIK_TOKEN to .env file
      const envFilePath = `${repoRoot}/.env`;
      await ensureFileExists({
        context,
        destinationFile: envFilePath,
        sourceFile: "",
      });
      await appendFile(envFilePath, `AUTHENTIK_TOKEN=${newToken}\n`);

      // get all the tokens
      // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-tokens-list
      const tokensResponse = await Bun.fetch(
        `${authentikUrl}/api/v3/core/tokens/`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${newToken}`,
          },
        }
      );
      if (tokensResponse.status !== 200) {
        throw new Error("Failed to get tokens from Authentik");
      }
      const tokens = await tokensResponse.json();
      const tokensSchema = z.object({
        pagination: paginationSchema,
        results: z.array(z.object({ pk: z.string(), identifier: z.string() })),
      });
      const tokensValidated = tokensSchema.parse(tokens);
      const bootstrapToken = tokensValidated.results.filter(
        (token) => token.pk !== userTokenPk
      );
      if (bootstrapToken.length !== 1) {
        throw new Error("Bootstrap token not found in Authentik");
      }
      const bootstrapTokenUuid = bootstrapToken[0]!.pk;

      // delete the bootstrap token
      // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-tokens-destroy
      const deleteTokenResponse = await Bun.fetch(
        `${authentikUrl}/api/v3/core/tokens/${bootstrapTokenUuid}/`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${newToken}`,
          },
        }
      );
      if (deleteTokenResponse.status !== 204) {
        throw new Error("Failed to delete bootstrap token in Authentik");
      }

      // get all the users
      // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-list
      const usersResponse = await Bun.fetch(
        `${authentikUrl}/api/v3/core/users/`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${newToken}`,
          },
        }
      );
      if (usersResponse.status !== 200) {
        throw new Error("Failed to get users from Authentik");
      }
      const users = await usersResponse.json();
      const usersSchema = z.object({
        pagination: paginationSchema,
        results: z.array(z.object({ pk: z.number(), username: z.string() })),
      });
      const usersValidated = usersSchema.parse(users);
      const bootstrapUser = usersValidated.results.find(
        (user) => user.username === authentikEmail
      );
      if (!bootstrapUser) {
        throw new Error("Bootstrap user not found in Authentik");
      }
      const bootstrapUserUuid = bootstrapUser.pk;

      // disable the bootstrap user
      // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-update
      const disableUserResponse = await Bun.fetch(
        `${authentikUrl}/api/v3/core/users/${bootstrapUserUuid}/`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${newToken}`,
          },
          body: JSON.stringify({ ...bootstrapUser, is_active: false }),
        }
      );
      if (disableUserResponse.status !== 200) {
        throw new Error("Failed to disable bootstrap user in Authentik");
      }
    }

    await updateConfigFile({
      configPath,
      context,
      updates: {
        provisionUser: true,
      },
    });
  }
};
