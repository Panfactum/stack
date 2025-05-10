import { join } from "path";
import { z } from "zod";
import kubeVaultTemplate from "@/templates/kube_vault_terragrunt.hcl" with { type: "file" };
import vaultCoreResourcesTemplate from "@/templates/vault_core_resources_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { parseErrorHandler } from "@/util/error/parseErrorHandler";
import { fileExists } from "@/util/fs/fileExists";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
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
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

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
  mainTask: PanfactumTaskWrapper
) {
  const { awsProfile, context, environment, clusterPath, region, kubeConfigContext } =
    options;

  const kubeDomain = await readYAMLFile({ filePath: join(clusterPath, "region.yaml"), context, validationSchema: z.object({ kube_domain: z.string() }) }).then((data) => data!.kube_domain);
  const vaultDomain = `vault.${kubeDomain}`;

  let vaultRootToken: string | undefined;
  let vaultRecoveryKeys: string[] | undefined;
  if (await fileExists(join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml"))) {

    // FIX: @seth - The vault token should be found using getPanfactumConfig
    const vaultSecrets = await sopsDecrypt({
      filePath: join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml"),
      context,
      validationSchema: z.object({
        root_token: z.string(),
        recovery_keys: z.array(z.string()),
      }),
    });

    if (!vaultSecrets) {
      throw new CLIError('Was not able to find vault token.')
    }
    const { root_token: rootToken, recovery_keys: recoveryKeys } = vaultSecrets;
    vaultRootToken = rootToken;
    vaultRecoveryKeys = recoveryKeys;
  }


  interface VaultContext {
    kubeContext?: string;
    rootToken?: string;
    vaultProxyPid?: number;
    vaultProxyPort?: number;
    recoveryKeys?: string[];
  }

  const tasks = mainTask.newListr<VaultContext>([
    {
      title: "Verify access",
      task: async (ctx) => {
        await getIdentity({ context, profile: awsProfile });
        const regionConfig = await readYAMLFile({ filePath: join(clusterPath, "region.yaml"), context, validationSchema: z.object({ kube_config_context: z.string() }) });
        ctx.kubeContext = regionConfig?.kube_config_context;
        if (!ctx.kubeContext) {
          throw new CLIError("Kube context not found");
        }
      },
    },
    await buildDeployModuleTask({
      taskTitle: "Deploy Vault",
      context,
      environment,
      region,
      skipIfAlreadyApplied: true,
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
      skip: () => !!vaultRootToken,
      task: async () => {
        if (!kubeConfigContext) {
          throw new CLIError("Kube config context not found");
        }

        // TODO: @seth Use the kubernetes SDK, not exec
        await execute({
          command: ["kubectl", "get", "pods", "-n", "vault", "-o", "json", "--context", kubeConfigContext],
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
              return false;
            }
          },
        });
      },
    },
    {
      title: "Vault Operator Initialization",
      skip: () => !!vaultRootToken && !!(vaultRecoveryKeys && vaultRecoveryKeys.length > 0),
      task: async (ctx) => {
        if (!ctx.kubeContext) {
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
          ctx.kubeContext,
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
          await writeYAMLFile({
            context,
            values: {
              status: "error",
            },
            overwrite: true,
            filePath: join(modulePath, ".pf.yaml"),
          });
          parseErrorHandler({
            error,
            errorMessage: "Failed to parse vault operator init",
            nonZodErrorMessage:
              "Unable to parse outputs from vault operator init",
            location: vaultOperatorInitCommand.join(" "),
          });
        }

        await sopsUpsert({
          values: {
            root_token: recoveryKeys!.root_token,
          },
          context,
          filePath: join(modulePath, "secrets.yaml"),
        });

        await sopsUpsert({
          values: {
            recovery_keys: recoveryKeys!.recovery_keys_hex.map(
              (key) => key
            ),
          },
          context,
          filePath: join(modulePath, "recovery.yaml"),
        });

        ctx.recoveryKeys = recoveryKeys!.recovery_keys_hex.map(
          (key) => key
        );
        ctx.rootToken = recoveryKeys!.root_token;
      }
    },
    {
      title: "Unseal Vault",
      skip: async () => {
        const data = await readYAMLFile({
          context,
          filePath: join(clusterPath, MODULES.KUBE_VAULT, "module.yaml"),
          validationSchema: z.object({
            extra_inputs: z.object({
              wait: z.boolean(),
            })
          }),
          throwOnEmpty: false,
          throwOnMissing: false,
        })
        return !!data?.extra_inputs?.wait;
      },
      task: async (ctx) => {
        if (!ctx.kubeContext) {
          throw new CLIError("Kube context not found");
        }
        const modulePath = join(clusterPath, MODULES.KUBE_VAULT);
        let vaultUnsealCommand: string[] = [];
        try {
          let sealedStatus = true;
          for (const key of vaultRecoveryKeys || ctx.recoveryKeys!) {
            vaultUnsealCommand = [
              "kubectl",
              "exec",
              "-i",
              "vault-0",
              "--namespace=vault",
              "--context",
              ctx.kubeContext,
              "--",
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
            await writeYAMLFile({
              context,
              values: {
                status: "error",
              },
              overwrite: true,
              filePath: join(modulePath, ".pf.yaml"),
            });
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
        } catch (error) {
          await writeYAMLFile({
            context,
            values: {
              status: "error",
            },
            overwrite: true,
            filePath: join(modulePath, ".pf.yaml"),
          });
          parseErrorHandler({
            error,
            errorMessage: "Failed to unseal Vault",
            nonZodErrorMessage: "Failed to unseal Vault",
            location: vaultUnsealCommand.join(" "),
          });
        }
      },
    },
    {
      title: "Start Vault Proxy",
      task: async (ctx) => {
        if (!ctx.kubeContext) {
          throw new CLIError("Kube context not found");
        }
        const modulePath = join(clusterPath, MODULES.VAULT_CORE_RESOURCES);
        const env = {
          ...process.env,
          VAULT_TOKEN: vaultRootToken || ctx.rootToken!,
        };
        const { pid, port } = await startVaultProxy({
          env,
          modulePath,
          kubeContext: ctx.kubeContext,
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
              skipIfAlreadyApplied: true,
              module: MODULES.VAULT_CORE_RESOURCES,
              initModule: true,
              hclIfMissing: await Bun.file(
                vaultCoreResourcesTemplate
              ).text(),
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                VAULT_TOKEN: vaultRootToken || ctx.rootToken!,
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
  ])

  return tasks;
}
