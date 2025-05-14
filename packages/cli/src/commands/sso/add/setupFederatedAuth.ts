import path, { join } from "path";
import { z } from "zod";
import authentikAwsSSO from "@/templates/authentik_aws_sso.hcl";
import authentikAwsSSOWithSCIM from "@/templates/authentik_aws_sso_with_scim.hcl";
import awsIamIdentityCenterPermissions from "@/templates/aws_iam_identity_center_permissions.hcl";
import { getIdentity } from "@/util/aws/getIdentity";
import { getConfigValuesFromFile } from "@/util/config/getConfigValuesFromFile";
import { getEnvironments, type EnvironmentMeta } from "@/util/config/getEnvironments";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { CLIError } from "@/util/error/error";
import { removeFile } from "@/util/fs/removeFile";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { upsertPFYAMLFile } from "@/util/yaml/upsertPFYAMLFile";
import type { PanfactumContext } from "@/util/context/context";
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
    restricted_reader_groups: ["restricted_engineers"],
    billing_admin_groups: ["billing_admins"]
}

const DEVELOPMENT_ENVIRONMENT_ACCESS = {
    superuser_groups: ["superusers", "privileged_engineers", "engineers"],
    admin_groups: ["restricted_engineers"],
    billing_admin_groups: ["billing_admins"]
}

export async function setupFederatedAuth(
    context: PanfactumContext,
    mainTask: PanfactumTaskWrapper
) {
    const config = await getPanfactumConfig({
        context,
        directory: process.cwd(),
    });

    const {
        aws_profile: awsProfile,
        environment,
        kube_config_context: kubeConfigContext,
        region,
    } = config;

    if (!environment || !region || !awsProfile) {
        throw new CLIError([
            "Cluster installation must be run from within a valid region-specific directory.",
            "If you do not have this file structure please ensure you've completed the initial setup steps here:",
            "https://panfactum.com/docs/edge/guides/bootstrapping/configuring-infrastructure-as-code#setting-up-your-repo",
        ]);
    }

    if (!kubeConfigContext) {
        throw new CLIError([
            "Kubernetes config context must be set in the configuration.",
        ]);
    }

    const environmentPath = path.join(
        context.repoVariables.environments_dir,
        environment
    );
    const clusterPath = path.join(environmentPath, region);

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
                const globalRegionData = await getConfigValuesFromFile({
                    context,
                    environment: MANAGEMENT_ENVIRONMENT,
                    region: GLOBAL_REGION
                })

                if (!globalRegionData?.aws_region) {
                    throw new CLIError("No region found in management/region.yaml")
                }

                const originalInputs = await getInputsFromAuthentikAWSSSOModule(context, join(clusterPath, MODULES.AUTHENTIK_AWS_SSO, "module.yaml"))

                ctx.awsAcsUrl = originalInputs?.aws_acs_url
                ctx.awsSignInUrl = originalInputs?.aws_sign_in_url
                ctx.awsIssuer = originalInputs?.aws_issuer
                ctx.awsScimUrl = originalInputs?.aws_scim_url

                if (ctx.awsScimUrl) {
                    task.skip("Already have Federated Auth configuration, skipping...");
                    return
                }

                if (!ctx.awsAcsUrl || !ctx.awsSignInUrl || !ctx.awsIssuer) {
                    if (!ctx.awsSignInUrl) {
                        const identityCenterURLChanged = await context.logger.confirm({
                            task,
                            explainer: `We need to setup IAM Identity Center in the ${globalRegionData.aws_region} region.\n\n` +
                                "Follow these instruction to change the portal URL:\n\n" +
                                "https://docs.aws.amazon.com/singlesignon/latest/userguide/howtochangeURL.html\n\n" +
                                "Keep the page open when you're done.",
                            message: "Have you changed your portal URL?",
                            default: true,
                        })

                        if (!identityCenterURLChanged) {
                            throw new CLIError("You must change your portal URL before continuing.")
                        }
                    }

                    const navigatedToExternIdPPage = await context.logger.confirm({
                        task,
                        explainer: "We need some additional information from the IAM Identity Center page.\n\n" +
                            "1. Select \"Settings\" from the side panel.\n\n" +
                            "2. Under the 'Identity Source' tab, select \"Change Identity Source\" from the \"Actions\" dropdown.\n\n" +
                            "3. Select \"External Identity Provider\" and click \"Next\".\n\n" +
                            "Keep this page open as we will need to copy some information from it now.",
                        message: "Do you have the External Identity Provider page open?",
                        default: true,
                    })

                    if (!navigatedToExternIdPPage) {
                        throw new CLIError("You must have the External Identity Provider page open before continuing.")
                    }

                    if (!ctx.awsSignInUrl) {
                        ctx.awsSignInUrl = await context.logger.input({
                            task,
                            message: "Enter the AWS access portal sign-in URL:",
                            required: true,
                        })
                    }

                    if (!ctx.awsAcsUrl) {
                        ctx.awsAcsUrl = await context.logger.input({
                            task,
                            message: "Enter the IAM Identity Center Assertion Consumer Service (ACS) URL:",
                            required: true,
                        })
                    }

                    if (!ctx.awsIssuer) {
                        ctx.awsIssuer = await context.logger.input({
                            task,
                            message: "Enter the IAM Identity Center issuer URL:",
                            required: true,
                        })
                    }
                }
            }
        },
        await buildDeployModuleTask<Context>({
            taskTitle: "Deploy Authentik AWS SSO",
            context,
            environment,
            region,
            env: { ...context.env },
            skipIfAlreadyApplied: true,
            module: MODULES.AUTHENTIK_AWS_SSO,
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
            skip: async (ctx) => {
                const originalInputs = await getInputsFromAuthentikAWSSSOModule(context, join(clusterPath, MODULES.AUTHENTIK_AWS_SSO, "module.yaml"))
                ctx.awsScimUrl = originalInputs?.aws_scim_url

                const secrets = await sopsDecrypt({
                    context,
                    filePath: join(clusterPath, MODULES.AUTHENTIK_AWS_SSO, "secrets.yaml"),
                    validationSchema: z.object({
                        aws_scim_token: z.string().optional()
                    })
                })

                return !secrets?.aws_scim_token || !ctx.awsScimUrl
            },
            task: async (ctx, task) => {
                const authentikModuleFilePath = join(clusterPath, MODULES.KUBE_AUTHENTIK, "module.yaml")
                const domain = await getAuthentikDomainFromModule(context, authentikModuleFilePath)

                const identityCenterURLChanged = await context.logger.confirm({
                    task,
                    explainer: "Next we will setup user synchronization from Authentik to AWS IAM Identity Center.\n\n" +
                        `1. Login to the Authentik dashboard at https://${domain}\n\n` +
                        "2. Click the \"Admin interface\" button in the top right.\n\n" +
                        "3. Navigate to \"Applications\" > \"Providers\" and select the \"aws\" provider.\n\n" +
                        "4. Under \"Related objects\" click the \"Download\" button for the Metadata object.",
                    message: "Have you downloaded the metadata from Authentik?",
                    default: true,
                })

                if (!identityCenterURLChanged) {
                    throw new CLIError("You must download the metadata from Authentik before continuing.")
                }

                const uploadedMetadataToAWS = await context.logger.confirm({
                    task,
                    explainer: "Next we will upload the metadata to AWS IAM Identity Center.\n\n" +
                        "1. Go back to AWS Identity Center which you opened earlier.\n\n" +
                        "2. Under \"IdP SAML metadata,\" use the \"Choose file\" button to upload the metadata you just downloaded.\n\n" +
                        "3. When that is done click \"Next\".\n\n" +
                        "4. Type \"ACCEPT\" and click \"Change identity source.\"\n\n" +
                        "5. You should now see a notification in the middle of the screen titled \"Automatic provisioning\".\n\n" +
                        "Click the \"Enable\" button and keep the modal open.",
                    message: "Have you completed the steps above?",
                    default: true,
                })

                if (!uploadedMetadataToAWS) {
                    throw new CLIError("You must upload the metadata to AWS before continuing.")
                }

                const originalInputs = await getInputsFromAuthentikAWSSSOModule(context, join(clusterPath, MODULES.AUTHENTIK_AWS_SSO, "module.yaml"))
                ctx.awsScimUrl = originalInputs?.aws_scim_url

                const skimToken = await sopsDecrypt({
                    context,
                    filePath: join(clusterPath, MODULES.AUTHENTIK_AWS_SSO, "secrets.yaml"),
                    validationSchema: z.object({
                        aws_scim_token: z.string().optional()
                    })
                })

                if (!ctx.awsScimUrl) {
                    ctx.awsScimUrl = await context.logger.input({
                        task,
                        message: "Enter the SCIM endpoint from the modal:",
                        required: true,
                    })
                }

                if (!skimToken?.aws_scim_token) {
                    const awsSCIMToken = await context.logger.password({
                        task,
                        message: "Enter the Access token from the modal:",
                    });
                    await sopsUpsert({
                        values: { aws_scim_token: awsSCIMToken },
                        context,
                        filePath: join(clusterPath, MODULES.AUTHENTIK_AWS_SSO, "secrets.yaml"),
                    });
                }

                // Delete the terragrunt.hcl file for the Authentik AWS SSO module
                // We do this to write a new one with the local from secrets.yaml in the next step
                const terragruntFilePath = join(clusterPath, MODULES.AUTHENTIK_AWS_SSO, "terragrunt.hcl");
                await removeFile(terragruntFilePath)
            }
        },
        await buildDeployModuleTask<Context>({
            taskTitle: "Update Authentik AWS SSO with SCIM",
            context,
            environment,
            region,
            env: { ...context.env },
            skipIfAlreadyApplied: false,
            module: MODULES.AUTHENTIK_AWS_SSO,
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
            skip: async () => {
                const authentikAWSSSOPfFileData = await readYAMLFile({
                    filePath: path.join(clusterPath, MODULES.AUTHENTIK_AWS_SSO, ".pf.yaml"),
                    context,
                    validationSchema: z
                        .object({
                            userSyncComplete: z.boolean().optional(),
                        })
                        .passthrough(),
                });

                return !authentikAWSSSOPfFileData?.userSyncComplete
            },
            task: async (_, task) => {
                const reRanSync = await context.logger.confirm({
                    task,
                    explainer: "Next we will sync the users for the first time.\n\n" +
                        "1. Login to the Authentik dashboard.\n\n" +
                        "2. Navigate to \"Applications\" > \"Providers\" and select the \"aws-scim\" provider.\n\n" +
                        "3. Under \"Sync status\" click \"Run sync again\".",
                    message: "Have you run the sync?",
                    default: true,
                })

                if (!reRanSync) {
                    throw new CLIError("You must re-run the sync before continuing.")
                }

                await upsertPFYAMLFile({
                    context,
                    environment,
                    region,
                    module: MODULES.AUTHENTIK_AWS_SSO,
                    updates: {
                        userSyncComplete: true
                    }
                })
            }
        },
        {
            title: "Setup IAM Identity Center Permissions",
            task: async (ctx, task) => {
                const environments = await getEnvironments(context);
                const environmentsWithAWSAccountId: Array<EnvironmentMeta & { aws_account_id: string }> = [];
                for (const environment of environments) {
                    const data = await readYAMLFile({
                        filePath: join(environment.path, "environment.yaml"),
                        context,
                        validationSchema: z.object({
                            aws_account_id: z.string(),
                        }).passthrough(),
                    })

                    if (!data?.aws_account_id) {
                        throw new CLIError(`No AWS account ID found for environment ${environment.name}`)
                    }

                    environmentsWithAWSAccountId.push({
                        ...environment,
                        aws_account_id: data.aws_account_id,
                    })
                }
                const productionEnvironments = await context.logger.checkbox({
                    task,
                    explainer: "All other environments will grant users full access. This can be changed later.",
                    message: "Select the environment(s) you want to security harden:",
                    choices: environmentsWithAWSAccountId.map((env) => ({ name: env.name, value: env })).filter((env) => env.name !== MANAGEMENT_ENVIRONMENT),
                    validate: (choices) => {
                        if (choices.length === 0) {
                            return 'You must choose at least one production environment.'
                        }

                        return true
                    }
                })
                const managementEnvironment = environmentsWithAWSAccountId.find(env => env.name === MANAGEMENT_ENVIRONMENT);
                if (!managementEnvironment) {
                    throw new CLIError("Management environment not found")
                }
                const developmentEnvironments = environmentsWithAWSAccountId.filter(env => env.name !== MANAGEMENT_ENVIRONMENT && !productionEnvironments.map(env => env.name).includes(env.name));
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
            hclIfMissing: await Bun.file(awsIamIdentityCenterPermissions).text(),
            skipIfAlreadyApplied: true,
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

async function getInputsFromAuthentikAWSSSOModule(context: PanfactumContext, orgModuleYAMLPath: string) {
    const originalInputs = await readYAMLFile({
        filePath: orgModuleYAMLPath,
        context,
        validationSchema: z.object({
            extra_inputs: z.object({
                aws_acs_url: z.string().optional(),
                aws_sign_in_url: z.string().optional(),
                aws_issuer: z.string().optional(),
                aws_scim_enabled: z.boolean().optional(),
                aws_scim_url: z.string().optional()
            }).passthrough().optional().default({})
        }).passthrough()
    })
    return originalInputs?.extra_inputs ?? {}
}

async function getAuthentikDomainFromModule(context: PanfactumContext, orgModuleYAMLPath: string) {
    const data = await readYAMLFile({
        filePath: orgModuleYAMLPath,
        context,
        validationSchema: z.object({
            extra_inputs: z.object({
                domain: z.string(),
            }).passthrough(),
        }).passthrough(),
    })
    return data?.extra_inputs.domain
}