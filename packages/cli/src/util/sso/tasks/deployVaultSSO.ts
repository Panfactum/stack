import { join } from "node:path";
import { z } from "zod";
import authentikVaultSSO from "@/templates/authentik_vault_sso.hcl";
import { getIdentity } from "@/util/aws/getIdentity";
import { getConfigValuesFromFile } from "@/util/config/getConfigValuesFromFile";
import { CLIError } from "@/util/error/error";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import type { InstallClusterStepOptions } from "@/commands/cluster/add/common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function deployVaultSSO(
    options: InstallClusterStepOptions,
    mainTask: PanfactumTaskWrapper
) {
    const { awsProfile, config, context, environment, region } =
        options;

    const vaultRootToken = config.vault_token

    if (!vaultRootToken) {
        throw new CLIError(
            "Vault root token not found in config."
        );
    }

    const regionConfig = await getConfigValuesFromFile({
        environment,
        context,
        region,
    })

    if (!regionConfig?.kube_config_context) {
        throw new CLIError(
            "Kube config context not found in region config."
        );
    }

    if (!regionConfig?.vault_addr) {
        throw new CLIError(
            "Vault address not found in region config."
        );
    }

    interface Context {
        client_id: string;
        oidc_discovery_url: string;
        oidc_redirect_uris: string[];
        oidc_issuer: string;
    }


    const tasks = mainTask.newListr<Context>([
        {
            title: "Verify access",
            task: async () => {
                await getIdentity({ context, profile: awsProfile });
            },
        },
        await buildDeployModuleTask({
            taskTitle: "Deploy Vault SSO",
            context,
            environment,
            region,
            module: MODULES.AUTHENTIK_VAULT_SSO + "_" + regionConfig?.kube_config_context,
            skipIfAlreadyApplied: true,
            realModuleName: MODULES.AUTHENTIK_VAULT_SSO,
            hclIfMissing: await Bun.file(authentikVaultSSO).text(),
            inputUpdates: {
                vault_name: defineInputUpdate({
                    schema: z.string(),
                    update: () => regionConfig.kube_config_context!,
                }),
                vault_domain: defineInputUpdate({
                    schema: z.string(),
                    update: () => regionConfig.vault_addr!.replace('https://', ''),
                }),
            },
        }),
        {
            title: "Get Vault OIDC configuration",
            task: async (ctx) => {
                const outputs = await terragruntOutput({
                    context,
                    environment,
                    region,
                    module: MODULES.VAULT_AUTH_OIDC,
                    validationSchema: z.object({
                        client_id: z.string(),
                        client_secret: z.string(),
                        oidc_discovery_url: z.string(),
                        oidc_redirect_uris: z.array(z.string()),
                        oidc_issuer: z.string(),
                    }),
                })

                ctx.client_id = outputs.client_id
                ctx.oidc_discovery_url = outputs.oidc_discovery_url
                ctx.oidc_redirect_uris = outputs.oidc_redirect_uris
                ctx.oidc_issuer = outputs.oidc_issuer

                await sopsUpsert({
                    values: {
                        client_secret: outputs.client_secret,
                    },
                    filePath: join(context.repoVariables.environments_dir, environment, region, MODULES.VAULT_AUTH_OIDC, "secrets.yaml"),
                    context,
                })
            },
        },
    ])

    return tasks
}