import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { z } from "zod";
import authentikAwsSSO from "@/templates/authentik_aws_sso.hcl";
import authentikAwsSSOWithSCIM from "@/templates/authentik_aws_sso_with_scim.hcl";
import awsIamIdentityCenterPermissions from "@/templates/aws_iam_identity_center_permissions.hcl";
import { getIdentity } from "@/util/aws/getIdentity";
import { getEnvironments, type EnvironmentMeta } from "@/util/config/getEnvironments";
import { CLIError } from "@/util/error/error";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import type { InstallClusterStepOptions } from "@/commands/cluster/add/common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

const MANAGEMENT_ENVIRONMENT_ACCESS = {
    superuser_groups: ["superusers"],
    restricted_reader_groups: ["privileged_engineers", "engineers"],
    billing_admin_groups: ["billing_admins"]
}

const PRODUCTION_ENVIRONMENT_ACCESS = {
    superuser_groups: ["superusers"],
    admin_groups: ["privileged_engineers"],
    reader_groups: ["engineers"],
    restricted_reader_groups: ["restricted_engineers", "demo_users"],
    billing_admin_groups: ["billing_admins"]
}

const DEVELOPMENT_ENVIRONMENT_ACCESS = {
    superuser_groups: ["superusers", "privileged_engineers", "engineers"],
    admin_groups: ["restricted_engineers"],
    billing_admin_groups: ["billing_admins"]
}

export async function setupFederatedAuth(
    options: InstallClusterStepOptions,
    mainTask: PanfactumTaskWrapper
) {
    const { awsProfile, context, environment, clusterPath, region } =
        options;


    const vaultSecretsFile = join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml")
    const vaultSecrets = await sopsDecrypt({
        filePath: vaultSecretsFile,
        context,
        validationSchema: z.object({
            root_token: z.string(),
        }),
    });

    if (vaultSecrets === null) {
        throw new CLIError(`Could not find vault token at ${vaultSecretsFile}`)
    }

    const { root_token: vaultRootToken } = vaultSecrets

    interface Context {
        awsAcsUrl?: string;
        awsSignInUrl?: string;
        awsIssuer?: string;
        awsScimUrl?: string;
        accountAccessConfiguration?: Record<string, {
            account_id: string;
            superuser_groups?: string[];
            reader_groups?: string[];
            restricted_reader_groups?: string[];
            admin_groups?: string[];
            billing_admin_groups?: string[];
        }>;
    }

    const tasks = mainTask.newListr<Context>([
        {
            title: "Verify access",
            task: async () => {
                await getIdentity({ context, profile: awsProfile });
            },
        },
        {
            title: "Get Federated Auth User Configuration",
            task: async (ctx, task) => {
                const data = await readYAMLFile({
                    filePath: join(context.repoVariables.environments_dir, "management", "region.yaml"),
                    context,
                    validationSchema: z.object({
                        region: z.string(),
                    }).passthrough(),
                })

                if (!data?.region) {
                    throw new CLIError("No region found in management/region.yaml")
                }

                // TODO: resumability

                const identityCenterURLChanged = await context.logger.confirm({
                    task,
                    explainer: `
                    We need to setup IAM Identity Center in the ${data.region} region.
                    Follow these instruction to change the portal URL:
                    https://docs.aws.amazon.com/singlesignon/latest/userguide/howtochangeURL.html
                    Keep the page open when you're done.
                    `,
                    message: "Have you changed your portal URL?",
                    default: true,
                })

                if (!identityCenterURLChanged) {
                    throw new CLIError("You must change your portal URL before continuing.")
                }

                const navigatedToExternIdPPage = await context.logger.confirm({
                    task,
                    explainer: `
                    We need some additional information from the IAM Identity Center page.
                    1. Select "Settings' from the side panel.
                    2. Under the "Identity Source" tab, select "Change Identity Source" from the "Actions" dropdown.
                    3. Select "External Identity Provider" and click "Next".
                    Keep this page open as we will need to copy some information from it now.
                    `,
                    message: "Do you have the External Identity Provider page open?",
                    default: true,
                })

                if (!navigatedToExternIdPPage) {
                    throw new CLIError("You must have the External Identity Provider page open before continuing.")
                }

                ctx.awsAcsUrl = await context.logger.input({
                    task,
                    message: "Enter the IAM Identity Center Assertion Consumer Service (ACS) URL",
                    required: true,
                })

                ctx.awsSignInUrl = await context.logger.input({
                    task,
                    message: "Enter the AWS access portal sign-in URL",
                    required: true,
                })

                ctx.awsIssuer = await context.logger.input({
                    task,
                    message: "Enter the IAM Identity Center issuer URL",
                    required: true,
                })
            }
        },
        await buildDeployModuleTask<Context>({
            taskTitle: "Deploy Authentik AWS SSO",
            context,
            environment,
            region,
            env: { ...context.env, VAULT_TOKEN: vaultRootToken },
            skipIfAlreadyApplied: true,
            module: MODULES.AUTHENTIK_AWS_SSO,
            initModule: true,
            hclIfMissing: await Bun.file(authentikAwsSSO).text(),
            inputUpdates: {
                aws_acs_url: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.awsAcsUrl!,
                }),
                aws_sign_in_url: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.awsSignInUrl!,
                }),
                aws_issuer: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.awsIssuer!,
                }),
                aws_scim_enabled: defineInputUpdate({
                    schema: z.boolean(),
                    update: () => false,
                }),
            },
        }),
        {
            title: "Get SCIM User Configuration",
            task: async (ctx, task) => {
                const data = await readYAMLFile({
                    filePath: join(clusterPath, MODULES.KUBE_AUTHENTIK, "module.yaml"),
                    context,
                    validationSchema: z.object({
                        extra_inputs: z.object({
                            domain: z.string(),
                        }).passthrough(),
                    }).passthrough(),
                })

                if (!data?.extra_inputs?.domain) {
                    throw new CLIError(`No domain found for Authentik in ${MODULES.KUBE_AUTHENTIK} module`)
                }

                const identityCenterURLChanged = await context.logger.confirm({
                    task,
                    explainer: `
                    Next we will setup user synchronization from Authentik to AWS IAM Identity Center.
                    1. Login to the Authentik dashboard at https://${data.extra_inputs.domain}
                    2. Click the "Admin interface" button in the top right.
                    3. Navigate to "Applications" > "Providers" and select the "aws" provider.
                    4. Under "Related objects" click the "Download" button for the Metadata object.
                    `,
                    message: "Have you downloaded the metadata from Authentik?",
                    default: true,
                })

                if (!identityCenterURLChanged) {
                    throw new CLIError("You must download the metadata from Authentik before continuing.")
                }

                const uploadedMetadataToAWS = await context.logger.confirm({
                    task,
                    explainer: `
                    Next we will upload the metadata to AWS IAM Identity Center.
                    1. Go back to AWS Identity Center which you opened earlier.
                    2. Under "IdP SAML metadata," use the "Choose file" button to upload the metadata you just downloaded.
                    3. When that is done click "Next".
                    4. Type "ACCEPT" and click "Change identity source."
                    5. You should now see a pop-up titled "Automatic provisioning". Click the "Enable" button.
                    `,
                    message: "Have you completed the steps above?",
                    default: true,
                })

                if (!uploadedMetadataToAWS) {
                    throw new CLIError("You must upload the metadata to AWS before continuing.")
                }

                ctx.awsScimUrl = await context.logger.input({
                    task,
                    message: "Enter the IAM Identity Center SCIM URL",
                    required: true,
                })

                const awsSCIMToken = await context.logger.password({
                    task,
                    message: "Enter the AWS SCIM token:",
                });
                await sopsUpsert({
                    values: { aws_scim_token: awsSCIMToken },
                    context,
                    filePath: join(clusterPath, MODULES.AUTHENTIK_AWS_SSO, "secrets.yaml"),
                });

                // Delete the terragrunt.hcl file for the Authentik AWS SSO module
                // We do this to 
                const terragruntFilePath = join(clusterPath, MODULES.AUTHENTIK_AWS_SSO, "terragrunt.hcl");
                if (existsSync(terragruntFilePath)) {
                    unlinkSync(terragruntFilePath);
                }
            }
        },
        await buildDeployModuleTask<Context>({
            taskTitle: "Deploy Authentik AWS SSO",
            context,
            environment,
            region,
            env: { ...context.env, VAULT_TOKEN: vaultRootToken },
            skipIfAlreadyApplied: true,
            module: MODULES.AUTHENTIK_AWS_SSO,
            initModule: false,
            hclIfMissing: await Bun.file(authentikAwsSSOWithSCIM).text(),
            inputUpdates: {
                aws_scim_url: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.awsScimUrl!,
                }),
                aws_scim_enabled: defineInputUpdate({
                    schema: z.boolean(),
                    update: () => true,
                }),
            },
        }),
        {
            title: "Sync Users and Groups",
            task: async (_, task) => {
                const reRanSync = await context.logger.confirm({
                    task,
                    explainer: `
                    Next we will sync the users for the first time.
                    1. Login to the Authentik dashboard.
                    2. Navigate to "Applications" > "Providers" and select the "aws-scim" provider.
                    3. Under "Sync status" click "Run sync again".
                    `,
                    message: "Have you run the sync?",
                    default: true,
                })

                if (!reRanSync) {
                    throw new CLIError("You must re-run the sync before continuing.")
                }
            }
        },
        {
            title: "Setup IAM Identity Center Permissions",
            task: async (ctx, task) => {
                const environments = await getEnvironments(context);
                const environmentsWithAWSAccountId: Array<EnvironmentMeta & { aws_account_id: string }> = [];
                environments.forEach(async (env) => {
                    const data = await readYAMLFile({
                        filePath: join(env.path, "environment.yaml"),
                        context,
                        validationSchema: z.object({
                            aws_account_id: z.string(),
                        }).passthrough(),
                    })

                    if (!data?.aws_account_id) {
                        throw new CLIError(`No AWS account ID found for environment ${env.name}`)
                    }

                    environmentsWithAWSAccountId.push({
                        ...env,
                        aws_account_id: data.aws_account_id,
                    })
                })
                const productionEnvironments = await context.logger.checkbox({
                    task,
                    message: "Select your production environment(s)",
                    choices: environmentsWithAWSAccountId.map((env) => ({ name: env.name, value: env })),
                })
                const managementEnvironment = environmentsWithAWSAccountId.find(env => env.name === "management");
                if (!managementEnvironment) {
                    throw new CLIError("Management environment not found")
                }
                const developmentEnvironments = environmentsWithAWSAccountId.filter(env => env.name !== "management" && !productionEnvironments.map(env => env.name).includes(env.name));
                ctx.accountAccessConfiguration = {
                    management: {
                        account_id: managementEnvironment.aws_account_id,
                        ...MANAGEMENT_ENVIRONMENT_ACCESS,
                    },
                    ...Object.fromEntries(productionEnvironments.map(env => [
                        env.name,
                        {
                            account_id: env.aws_account_id,
                            ...PRODUCTION_ENVIRONMENT_ACCESS,
                        }
                    ])),
                    ...Object.fromEntries(developmentEnvironments.map(env => [
                        env.name,
                        {
                            account_id: env.aws_account_id,
                            ...DEVELOPMENT_ENVIRONMENT_ACCESS,
                        }
                    ])),
                }
            }
        },
        await buildDeployModuleTask<Context>({
            taskTitle: "Deploy IAM Identity Center Permissions",
            context,
            environment: MANAGEMENT_ENVIRONMENT,
            region: GLOBAL_REGION,
            module: MODULES.AWS_IAM_IDENTITY_CENTER_PERMISSIONS,
            initModule: true,
            hclIfMissing: await Bun.file(awsIamIdentityCenterPermissions).text(),
            inputUpdates: {
                account_access_configuration: defineInputUpdate({
                    schema: z.record(z.string(), z.object({
                        account_id: z.string(),
                        superuser_groups: z.array(z.string()).optional(),
                        reader_groups: z.array(z.string()).optional(),
                        restricted_reader_groups: z.array(z.string()).optional(),
                        admin_groups: z.array(z.string()).optional(),
                        billing_admin_groups: z.array(z.string()).optional(),
                    })),
                    update: (_, ctx) => ctx.accountAccessConfiguration!,
                }),
            },
        }),
        await buildDeployModuleTask<Context>({
            taskTitle: "Updating EKS to use AWS SSO",
            context,
            environment,
            region,
            module: MODULES.AWS_EKS,
        })
    ])

    return tasks;
}