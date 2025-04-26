import { join } from "path";
import { Listr } from "listr2";
import { z } from "zod";
import kubeVaultTemplate from "@/templates/kube_vault_terragrunt.hcl" with { type: "file" };
import vaultCoreResourcesTemplate from "@/templates/vault_core_resources_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { parseErrorHandler } from "@/util/error/parseErrorHandler";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { execute } from "@/util/subprocess/execute";
import { killBackgroundProcess } from "@/util/subprocess/killBackgroundProcess";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { MODULES } from "@/util/terragrunt/constants";
import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { updateModuleYAMLFile } from "@/util/yaml/updateModuleYAMLFile";
import type { InstallClusterStepOptions } from "./common";

const RECOVER_KEYS_SCHEMA = z.object({
  unseal_keys_b64: z.array(z.string().base64()),
  unseal_keys_hex: z.array(z.string()),
  unseal_shares: z.number(),
  unseal_threshold: z.number(),
  recovery_keys_b64: z.array(z.string().base64()),
  recovery_keys_hex: z.array(z.string()),
  recovery_keys_shares: z.number(),
  recovery_keys_threshold: z.number(),
  root_token: z.string(),
});

const UNSEAL_OUTPUT_SCHEMA = z.object({
  type: z.string(),
  initialized: z.boolean(),
  sealed: z.boolean(),
  t: z.number(),
  n: z.number(),
  progress: z.number(),
  nonce: z.string(),
  version: z.string(),
  build_date: z.string(),
  migration: z.boolean(),
  cluster_name: z.string(),
  cluster_id: z.string(),
  recovery_seal: z.boolean(),
  storage_type: z.string(),
  ha_enabled: z.boolean(),
  is_self: z.boolean(),
  active_time: z.string(),
  leader_address: z.string(),
  leader_cluster_address: z.string(),
  raft_committed_index: z.number(),
  raft_applied_index: z.number(),
});

export async function setupVault(
  options: InstallClusterStepOptions,
  completed: boolean
) {
  const { awsProfile, context, environment, clusterPath, kubeConfigContext, region } =
    options;

  const kubeDomain = await readYAMLFile({ filePath: join(clusterPath, "region.yaml"), context, validationSchema: z.object({ kube_domain: z.string() }) }).then((data) => data!.kube_domain);
  const vaultDomain = `vault.${kubeDomain}`;

  const tasks = new Listr([]);

  tasks.add({
    skip: () => completed,
    title: "Deploy Vault",

    task: async (_, parentTask) => {
      interface VaultContext {
        vaultToken?: string;
        vaultProxyPid?: number;
        vaultProxyPort?: number;
      }
      return parentTask.newListr<VaultContext>([
        {
          title: "Verify access",
          task: async () => {
            await getIdentity({ context, profile: awsProfile });
          },
        },
        await buildDeployModuleTask({
          taskTitle: "Deploy Vault",
          context,
          environment,
          region,
          module: MODULES.KUBE_VAULT,
          initModule: true,
          hclIfMissing: await Bun.file(kubeVaultTemplate).text(),
          inputUpdates: {
            vault_domain: defineInputUpdate({
              schema: z.string(),
              update: () => vaultDomain,
            }),
            wait: defineInputUpdate({
              schema: z.boolean(),
              update: () => false,
            }),
            ingress_enabled: defineInputUpdate({
              schema: z.boolean(),
              update: () => false,
            }),
          },
        }),
        {
          title: "Checking status of the Vault pods",
          task: async () => {
            // TODO: @seth Use the kubernetes SDK, not exec
            await execute({
              command: ["kubectl", "get", "pods", "-n", "vault", "-o", "json"],
              context,
              workingDirectory: process.cwd(),
              errorMessage: "Vault pods failed to start",
              retries: 60,
              isSuccess: (result) => {
                try {
                  const pods = JSON.parse(result.stdout);
                  const podsSchema = z.object({
                    items: z.array(
                      z.object({
                        metadata: z.object({
                          name: z.string(),
                          namespace: z.string(),
                        }),
                        status: z.object({
                          phase: z.string(),
                        }),
                      })
                    ),
                  });
                  const parsedPods = podsSchema.parse(pods);
                  return parsedPods.items.every(
                    (pod) => pod.status.phase === "Running"
                  );
                } catch {
                  context.logger.log("Failed to parse Vault pods", {
                    level: "debug",
                    style: "warning",
                  });
                  return false;
                }
              },
            });
          },
        },
        {
          title: "Vault Operator Initialization",
          task: async (ctx) => {
            let kubeContext = kubeConfigContext;
            if (!kubeContext) {
              const kubeConfig = await readYAMLFile({ filePath: join(clusterPath, "region.yaml"), context, validationSchema: z.object({ kube_config_context: z.string() }) });
              kubeContext = kubeConfig?.kube_config_context;
            }
            if (!kubeContext) {
              throw new CLIError("Kube context not found");
            }
            const modulePath = join(clusterPath, MODULES.KUBE_VAULT);
            const vaultOperatorInitCommand = [
              "kubectl",
              "exec",
              "-i",
              "vault-0",
              "--namespace=vault",
              "--context",
              kubeContext,
              "--",
              "vault",
              "operator",
              "init",
              "-recovery-shares=1",
              "-recovery-threshold=1",
              "-format=json",
            ];
            let recoveryKeys: z.infer<typeof RECOVER_KEYS_SCHEMA>;
            try {
              const { stdout } = await execute({
                command: vaultOperatorInitCommand,
                context,
                workingDirectory: process.cwd(),
                errorMessage: "Failed to initialize vault",
              });

              const data = JSON.parse(stdout.trim());
              recoveryKeys = RECOVER_KEYS_SCHEMA.parse(data);
            } catch (error) {
              parseErrorHandler({
                error,
                zodErrorMessage: "Failed to parse vault operator init",
                genericErrorMessage:
                  "Unable to parse outputs from vault operator init",
                command: vaultOperatorInitCommand.join(" "),
              });
            }

            let vaultUnsealCommand: string[] = [];
            try {
              let kubeContext = kubeConfigContext;
              if (!kubeContext) {
                const kubeConfig = await readYAMLFile({ filePath: join(clusterPath, "region.yaml"), context, validationSchema: z.object({ kube_config_context: z.string() }) });
                kubeContext = kubeConfig?.kube_config_context;
              }
              if (!kubeContext) {
                throw new CLIError("Kube context not found");
              }
              let sealedStatus = true;
              for (const key of recoveryKeys!.recovery_keys_hex) {
                vaultUnsealCommand = [
                  "kubectl",
                  "exec",
                  "-i",
                  "vault-0",
                  "--namespace=vault",
                  "--context",
                  kubeContext,
                  "vault",
                  "operator",
                  "unseal",
                  "-format=json",
                  key,
                ];
                const { stdout } = await execute({
                  command: vaultUnsealCommand,
                  context,
                  workingDirectory: process.cwd(),
                  errorMessage: "Failed to unseal Vault",
                });

                const statusData = JSON.parse(stdout.trim());
                const unsealOutput = UNSEAL_OUTPUT_SCHEMA.parse(statusData);
                sealedStatus = unsealOutput.sealed;
                if (!sealedStatus) {
                  break;
                }
              }

              if (sealedStatus) {
                throw new CLIError(
                  "Failed to unseal Vault after applying all recovery keys"
                );
              }

              await updateModuleYAMLFile({
                context,
                environment,
                region,
                module: MODULES.KUBE_VAULT,
                inputUpdates: { wait: true },
              });

              ctx.vaultToken = recoveryKeys!.root_token;

              await sopsUpsert({
                values: {
                  root_token: recoveryKeys!.root_token,
                  recovery_keys: recoveryKeys!.recovery_keys_hex.map(
                    (key) => key
                  ),
                },
                context,
                filePath: join(modulePath, "secrets.yaml"),
              });
            } catch (error) {
              parseErrorHandler({
                error,
                zodErrorMessage: "Failed to unseal Vault",
                genericErrorMessage: "Failed to unseal Vault",
                command: vaultUnsealCommand.join(" "),
              });
            }
          },
        },
        {
          title: "Start Vault Proxy",
          task: async (ctx) => {
            const modulePath = join(clusterPath, MODULES.VAULT_CORE_RESOURCES);
            const env = {
              ...process.env,
              VAULT_TOKEN: ctx.vaultToken,
            };
            const { pid, port } = await startVaultProxy({
              env,
              modulePath,
            });
            ctx.vaultProxyPid = pid;
            ctx.vaultProxyPort = port;
          },
        },
        {
          task: async (ctx, task) => {
            return task.newListr<VaultContext>(
              [
                await buildDeployModuleTask({
                  taskTitle: "Deploy Vault Core Resources",
                  context,
                  environment,
                  region,
                  module: MODULES.VAULT_CORE_RESOURCES,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    vaultCoreResourcesTemplate
                  ).text(),
                  env: {
                    ...process.env,
                    VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                    VAULT_TOKEN: ctx.vaultToken,
                  },
                }),
              ],
              { ctx }
            );
          },
        },
        {
          title: "Stop Vault Proxy",
          task: async (ctx) => {
            if (ctx.vaultProxyPid) {
              killBackgroundProcess({ pid: ctx.vaultProxyPid, context });
            }
          },
        },
      ]);
    },
  });

  try {
    await tasks.run();
  } catch (e) {
    throw new CLIError("Failed to setup Vault", e);
  }
}
