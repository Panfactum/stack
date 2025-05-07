import { join } from "path";
import { z } from "zod";
import authentikAwsSSO from "@/templates/authentik_aws_sso.hcl";
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupFederatedAuth(
    options: InstallClusterStepOptions,
    mainTask: PanfactumTaskWrapper
) {
    const { awsProfile, context, environment, clusterPath, region } =
        options;


    const { root_token: vaultRootToken } = await sopsDecrypt({
        filePath: join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml"),
        context,
        validationSchema: z.object({
            root_token: z.string(),
        }),
    });


    interface Context {
        awsAcsUrl?: string;
        awsSignInUrl?: string;
        awsIssuer?: string;
        awsScimUrl?: string;
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
                    2. Under the “Identity Source” tab, select “Change Identity Source” from the “Actions” dropdown.
                    3. Select "External Identity Provider" from the dropdown.
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
            task: async (_, task) => {
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
                    1. Loging to the Authentik dashboard at https://${data.extra_inputs.domain}
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
                    Next we will setup user synchronization from Authentik to AWS IAM Identity Center.
                    1. Loging to the Authentik dashboard at https://${data.extra_inputs.domain}
                    2. Click the "Admin interface" button in the top right.
                    3. Navigate to "Applications" > "Providers" and select the "aws" provider.
                    4. Under "Related objects" click the "Download" button for the Metadata object.
                    `,
                    message: "Have you downloaded the metadata from Authentik?",
                    default: true,
                })

                if (!uploadedMetadataToAWS) {
                    throw new CLIError("You must upload the metadata to AWS before continuing.")
                }
            }
        }
    ])

    return tasks;
}