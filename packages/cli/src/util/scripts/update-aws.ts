import { mkdir } from "fs/promises";
import { appendFileSync } from "node:fs";
import yaml from "yaml";
import { z } from "zod";
import { safeFileExists } from "../safe-file-exists";
import { checkRepoSetup } from "./check-repo-setup";
import { getAWSStateHash } from "./get-aws-state-hash";
import { getRepoVariables } from "./get-repo-variables";
import { getModuleOutputs } from "./helpers/terragrunt/get-module-outputs";
import awsConfigExample from "../../files/aws/config.example.yaml" with { type: "file" };
import type { BaseContext } from "clipanion";

function camelToSnakeCase(str: string) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

async function appendToConfig({
  awsTmpFilePath,
  cliConfig,
  context,
  validatedConfigFile,
}: {
  awsTmpFilePath: string;
  cliConfig: {
    account_name: string;
    account_id: string;
    roles: string[];
  }[];
  context: BaseContext;
  validatedConfigFile: {
    sso_start_url: string;
    sso_region: string;
    default_aws_region?: string;
    module?: string;
    extra_roles?: {
      account_name: string;
      account_id: string;
      roles: string[];
    }[];
  };
}) {
  await Bun.write(Bun.file(awsTmpFilePath), "");
  const numberOfAccounts = cliConfig.length;
  for (let i = 0; i < numberOfAccounts; i++) {
    const accountName = cliConfig[i]?.account_name;
    const accountId = cliConfig[i]?.account_id;
    const roles = cliConfig[i]?.roles;

    if (accountName === undefined || accountName === null) {
      context.stderr.write(`Error: account_name is not set at index ${i}.`);
      throw new Error(`Error: account_name is not set at index ${i}.`);
    }

    if (accountId === undefined || accountId === null) {
      context.stderr.write(`Error: account_id is not set at index ${i}.`);
      throw new Error(`Error: account_id is not set at index ${i}.`);
    }

    if (roles === undefined || roles === null) {
      context.stderr.write(`Error: roles is not set at index ${i}.`);
      throw new Error(`Error: roles is not set at index ${i}.`);
    }

    const numberOfRoles = roles.length;
    for (let j = 0; j < numberOfRoles; j++) {
      const role = roles[j];
      if (role === undefined || role === null) {
        context.stderr.write(`Error: role is not set at index ${i}.`);
        throw new Error(`Error: role is not set at index ${i}.`);
      }
      const profileName = `${camelToSnakeCase(accountName)}-${camelToSnakeCase(role)}`;
      appendFileSync(awsTmpFilePath, `[profile ${profileName}]\n`);
      appendFileSync(awsTmpFilePath, `sso_session = ${profileName}\n`);
      appendFileSync(awsTmpFilePath, `sso_account_id = ${accountId}\n`);
      appendFileSync(awsTmpFilePath, `sso_role_name = ${role}\n`);
      appendFileSync(awsTmpFilePath, `output = text\n`);
      if (validatedConfigFile.default_aws_region) {
        appendFileSync(
          awsTmpFilePath,
          `region = ${validatedConfigFile.default_aws_region}\n`
        );
      }
      appendFileSync(awsTmpFilePath, `[sso-session ${profileName}]\n`);
      appendFileSync(
        awsTmpFilePath,
        `sso_start_url = ${validatedConfigFile.sso_start_url}\n`
      );
      appendFileSync(
        awsTmpFilePath,
        `sso_region = ${validatedConfigFile.sso_region}\n`
      );
      appendFileSync(
        awsTmpFilePath,
        `sso_registration_scopes = sso:account:access\n`
      );
      appendFileSync(awsTmpFilePath, `\n`);
    }
  }
}

// Purpose: Adds the standard .aws configuration files
export async function updateAWS({
  buildAwsConfig,
  context,
}: {
  buildAwsConfig?: boolean;
  context: BaseContext;
}) {
  const repoVariables = await getRepoVariables({ context });
  const awsDir = repoVariables.aws_dir;

  //####################################################################
  // Step 1: Copy the static files
  //####################################################################
  await mkdir(awsDir, { mode: 0o755, recursive: true });
  const configFileExample = Bun.file(awsConfigExample);
  await Bun.write(
    Bun.file(awsDir + "/config.example.yaml"),
    configFileExample,
    {
      mode: 0o644,
    }
  );

  //####################################################################
  // Step 2: Dynamically configure known_hosts
  //####################################################################
  const awsTmpFilePath = `${awsDir}/config.tmp`;
  const awsConfigFilePath = `${awsDir}/config`;

  if (buildAwsConfig) {
    if (await safeFileExists(awsDir + "/config.yaml")) {
      //############################################################
      // Step 2.1: Parse the config file
      //############################################################
      const configFile = yaml.parse(
        await Bun.file(awsDir + "/config.yaml").text()
      );
      const configFileSchema = z.object({
        sso_start_url: z.string({
          required_error:
            "Error: sso_start_url is not set. Add it to the config.yaml.",
        }),
        sso_region: z.string({
          required_error:
            "Error: sso_region is not set. Add it to the config.yaml.",
        }),
        default_aws_region: z.string().optional(),
        module: z.string().optional(),
        extra_roles: z
          .array(
            z.object({
              account_name: z.string(),
              account_id: z.string(),
              roles: z.array(z.string()),
            })
          )
          .optional(),
      });
      const validatedConfigFile = configFileSchema.parse(configFile);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { module, extra_roles } = validatedConfigFile;

      //###########################################################
      // Step 2.2: Add config from module outputs (if provided)
      //###########################################################
      if (module) {
        const modulePath = `${repoVariables.environments_dir}/${module}`;
        context.stdout.write(`Retrieving roles from ${modulePath}...\n`);
        const moduleOutput = getModuleOutputs({
          context,
          modulePath,
          validationSchema: z.object({
            cli_config: z.array(
              z.object({
                account_name: z.string(),
                account_id: z.string(),
                roles: z.array(z.string()),
              })
            ),
          }),
        });
        appendToConfig({
          awsTmpFilePath,
          cliConfig: moduleOutput.cli_config,
          context,
          validatedConfigFile,
        });
        context.stdout.write("Roles retrieved.\n");
      } else {
        context.stdout.write(
          "Warning: module not specified. Not retrieving dynamic roles."
        );
      }

      //###########################################################
      // Step 2.3: Add static config (if provided)
      //###########################################################
      if (extra_roles) {
        context.stdout.write("Adding static roles from config file...\n");
        appendToConfig({
          awsTmpFilePath,
          cliConfig: extra_roles,
          context,
          validatedConfigFile,
        });
        context.stdout.write("Roles added.\n");
      }

      //###########################################################
      // Step 2.4: Make the tmp config the real config
      //###########################################################
      const sourceFile = Bun.file(awsTmpFilePath);
      const destinationFile = Bun.file(awsConfigFilePath);
      await destinationFile.write(await sourceFile.text());
      await sourceFile.delete();
    }
  } else {
    context.stdout.write(
      "Warning: No configuration file exists at $CONFIG_FILE Skipping config setup..."
    );
  }

  // Save the state hash
  const stateHash = await getAWSStateHash({ context });
  await Bun.write(Bun.file(awsDir + "/state.lock"), stateHash);

  context.stdout.write("AWS config files in $AWS_DIR were updated.\n");

  if (process.env["PF_SKIP_CHECK_REPO_SETUP"] !== "1") {
    await checkRepoSetup({ context });
  }
}
