import { join } from "path";
import { z } from "zod";
import kubeVaultTemplate from "@/templates/kube_vault_terragrunt.hcl" with { type: "file" };
import vaultCoreResourcesTemplate from "@/templates/vault_core_resources_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig.ts";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { parseJson } from "@/util/json/parseJson";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { execute } from "@/util/subprocess/execute";
import { MODULES } from "@/util/terragrunt/constants";
import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import { startVaultProxy } from "@/util/vault/startVaultProxy";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import type { IInstallClusterStepOptions } from "./common";
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
  options: IInstallClusterStepOptions,
  mainTask: PanfactumTaskWrapper
) {
  const { awsProfile, context, environment, clusterPath, region, kubeConfigContext } =
    options;

  const config = await getPanfactumConfig({
    context,
    directory: clusterPath,
  });

  const kubeDomain = config.kube_domain;

  if (!kubeDomain) {
    throw new CLIError("Kube domain not found in config");
  }

  const vaultDomain = `vault.${kubeDomain}`;

  let vaultRootToken: string | undefined;
  let vaultRecoveryKeys: string[] | undefined;

  if (await fileExists({ filePath: join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml") })) {
    const vaultRecovery = await sopsDecrypt({
      filePath: join(clusterPath, MODULES.KUBE_VAULT, "recovery.yaml"),
      context,
      validationSchema: z.object({
        recovery_keys: z.array(z.string()),
      }),
    });

    if (!vaultRecovery) {
      throw new CLIError('Was not able to find vault recovery keys.')
    }

    const { recovery_keys: recoveryKeys } = vaultRecovery;

    vaultRecoveryKeys = recoveryKeys;
  }


  interface IVaultContext {
    kubeContext?: string;
    rootToken?: string;
    vaultProxyPid?: number;
    vaultProxyPort?: number;
    recoveryKeys?: string[];
  }

  const tasks = mainTask.newListr<IVaultContext>([
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
          workingDirectory: clusterPath,
          errorMessage: "Vault pods failed to start",
          retries: 60,
          isSuccess: (result) => {
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
            try {
              const pods = parseJson(podsSchema, result.stdout);
              return pods.items.every(
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

        const { stdout } = await execute({
          command: vaultOperatorInitCommand,
          context,
          workingDirectory: clusterPath,
          errorMessage: "Failed to initialize vault",
        }).catch(async (error) => {
          await writeYAMLFile({
            context,
            values: {
              status: "error",
            },
            overwrite: true,
            filePath: join(modulePath, ".pf.yaml"),
          });
          throw error;
        });

        const recoveryKeys = parseJson(RECOVER_KEYS_SCHEMA, stdout.trim());

        await sopsUpsert({
          values: {
            vault_token: recoveryKeys.root_token,
          },
          context,
          filePath: join(clusterPath, "region.secrets.yaml"),
        });

        await sopsUpsert({
          values: {
            recovery_keys: recoveryKeys.recovery_keys_hex.map(
              (key) => key
            ),
          },
          context,
          filePath: join(modulePath, "recovery.yaml"),
        });

        ctx.recoveryKeys = recoveryKeys.recovery_keys_hex.map(
          (key) => key
        );
        ctx.rootToken = recoveryKeys.root_token;
      }
    },
    {
      title: "Unseal Vault",
      skip: async (ctx) => {
        if (!ctx.kubeContext) {
          throw new CLIError("Kube context not found");
        }

        const { stdout } = await execute({
          command: [
            "kubectl",
            "exec",
            "-i",
            "vault-0",
            "--namespace=vault",
            "--context",
            ctx.kubeContext,
            "--",
            "vault",
            "status",
            "-format=json",
          ],
          context,
          workingDirectory: clusterPath,
          errorMessage: "Failed to check Vault status",
        });

        const statusSchema = z.object({
          sealed: z.boolean(),
        });

        const statusData = parseJson(statusSchema, stdout.trim());

        return !statusData.sealed
      },
      task: async (ctx) => {
        if (!ctx.kubeContext) {
          throw new CLIError("Kube context not found");
        }
        let vaultUnsealCommand: string[] = [];

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
            workingDirectory: clusterPath,
            errorMessage: "Failed to unseal Vault",
          });

          const unsealOutput = parseJson(UNSEAL_OUTPUT_SCHEMA, stdout.trim());
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

        await upsertConfigValues({
          context,
          environment,
          region,
          module: MODULES.KUBE_VAULT,
          values: {
            extra_inputs: {
              wait: undefined
            }
          }
        });
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
        };
        const { pid, port } = await startVaultProxy({
          context,
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
        return task.newListr<IVaultContext>(
          [
            await buildDeployModuleTask({
              taskTitle: "Deploy Vault Core Resources",
              context,
              environment,
              region,
              skipIfAlreadyApplied: true,
              module: MODULES.VAULT_CORE_RESOURCES,
              hclIfMissing: await Bun.file(
                vaultCoreResourcesTemplate
              ).text(),
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
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
          await context.backgroundProcessManager.killProcess({ pid: ctx.vaultProxyPid });
        }
      },
    },
  ])

  return tasks;
}
