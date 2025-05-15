import { join } from "node:path";
import { z } from "zod";
import authentikVaultSSO from "@/templates/authentik_vault_sso.hcl";
import vaultAuthOIDC from "@/templates/vault_auth_oidc.hcl";
import { getIdentity } from "@/util/aws/getIdentity";
import { getConfigValuesFromFile } from "@/util/config/getConfigValuesFromFile";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { buildSyncAWSIdentityCenterTask } from "@/util/devshell/tasks/syncAWSIdentityCenterTask";
import { CLIError } from "@/util/error/error";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { execute } from "@/util/subprocess/execute";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import type { PanfactumContext } from "@/util/context/context";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupVaultSSO(
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
        region,
        kube_config_context: kubeContext,
        vault_token: vaultToken,
    } = config;

    if (!environment || !region || !awsProfile || !kubeContext) {
        throw new CLIError([
            "Cluster installation must be run from within a valid region-specific directory.",
            "If you do not have this file structure please ensure you've completed the initial setup steps here:",
            "https://panfactum.com/docs/edge/guides/bootstrapping/configuring-infrastructure-as-code#setting-up-your-repo",
        ]);
    }

    const environmentPath = join(
        context.repoVariables.environments_dir,
        environment
    );
    const clusterPath = join(environmentPath, region);

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

    const authentikAWSSSOConfig = await getConfigValuesFromFile({
        environment,
        context,
        region,
        module: MODULES.AUTHENTIK_AWS_SSO,
    })

    if (!authentikAWSSSOConfig?.extra_inputs?.["aws_sign_in_url"]) {
        throw new CLIError(
            `AWS SSO sign in URL not found in ${MODULES.AUTHENTIK_AWS_SSO} config.`
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
                    update: () => `vault-${regionConfig.kube_config_context!}`,
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
                    module: MODULES.AUTHENTIK_VAULT_SSO + "_" + regionConfig?.kube_config_context,
                    validationSchema: z.object({
                        client_id: z.object({
                            value: z.string(),
                        }),
                        client_secret: z.object({
                            value: z.string(),
                        }),
                        oidc_discovery_url: z.object({
                            value: z.string(),
                        }),
                        oidc_redirect_uris: z.object({
                            value: z.array(z.string()),
                        }),
                        oidc_issuer: z.object({
                            value: z.string(),
                        }),
                    }),
                })

                ctx.client_id = outputs.client_id.value
                ctx.oidc_discovery_url = outputs.oidc_discovery_url.value
                ctx.oidc_redirect_uris = outputs.oidc_redirect_uris.value
                ctx.oidc_issuer = outputs.oidc_issuer.value

                await sopsUpsert({
                    values: {
                        client_secret: outputs.client_secret.value,
                    },
                    filePath: join(context.repoVariables.environments_dir, environment, region, MODULES.VAULT_AUTH_OIDC, "secrets.yaml"),
                    context,
                })
            },
        },
        await buildDeployModuleTask<Context>({
            taskTitle: "Deploy Vault OIDC",
            context,
            environment,
            region,
            module: MODULES.VAULT_AUTH_OIDC,
            skipIfAlreadyApplied: true,
            hclIfMissing: await Bun.file(vaultAuthOIDC).text(),
            inputUpdates: {
                client_id: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.client_id!,
                }),
                oidc_discovery_url: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.oidc_discovery_url!,
                }),
                oidc_redirect_uris: defineInputUpdate({
                    schema: z.array(z.string()),
                    update: (_, ctx) => ctx.oidc_redirect_uris,
                }),
                oidc_issuer: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.oidc_issuer!,
                }),
            },
        }),
        {
            title: "Removing static Vault credentials",
            skip: () => vaultToken === undefined,
            task: async () => {
                const vaultTokenRevokeCommand = [
                    "kubectl",
                    "exec",
                    "-i",
                    "vault-0",
                    "--namespace=vault",
                    "--context",
                    kubeContext,
                    "--",
                    `VAULT_TOKEN=${vaultToken}`,
                    "vault",
                    "token",
                    "revoke",
                    "-self",
                ];

                await execute({
                    command: vaultTokenRevokeCommand,
                    context,
                    workingDirectory: process.cwd(),
                    errorMessage: "Failed to revoke vault token",
                });

                await sopsUpsert({
                    values: {
                        vault_token: undefined
                    },
                    context,
                    filePath: join(clusterPath, "region.secrets.yaml"),
                });
            },
        },
        await buildSyncAWSIdentityCenterTask({ context, startURL: authentikAWSSSOConfig.extra_inputs["aws_sign_in_url"] })
    ])

    return tasks
}