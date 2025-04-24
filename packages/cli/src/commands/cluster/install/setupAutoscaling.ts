import { join } from "node:path";
import { Listr } from "listr2";
import { z } from "zod";
import kubeKarpenterNodePoolsTerragruntHcl from "@/templates/kube_karpenter_node_pools_terragrunt.hcl" with { type: "file" };
import kubeKarpenterTerragruntHcl from "@/templates/kube_karpenter_terragrunt.hcl" with { type: "file" };
import kubeMetricsServerTerragruntHcl from "@/templates/kube_metrics_server_terragrunt.hcl" with { type: "file" };
import kubeSchedulerTerragruntHcl from "@/templates/kube_scheduler_terragrunt.hcl" with { type: "file" };
import kubeVpaTerragruntHcl from "@/templates/kube_vpa_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { CLIError } from "@/util/error/error";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { killBackgroundProcess } from "@/util/subprocess/killBackgroundProcess";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { MODULES } from "@/util/terragrunt/constants";
import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntApplyAll } from "@/util/terragrunt/terragruntApplyAll";
import type { InstallClusterStepOptions } from "./common";

export async function setupAutoscaling(
  options: InstallClusterStepOptions,
  completed: boolean
) {
  const { awsProfile, context, environment, clusterPath, region, slaTarget } =
    options;

  const tasks = new Listr([]);

  const { root_token: vaultRootToken } = await sopsDecrypt({
    filePath: join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml"),
    context,
    validationSchema: z.object({
      root_token: z.string(),
    }),
  });

  tasks.add({
    skip: () => completed,
    title: "Deploy Autoscaling",
    task: async (_, parentTask) => {
      interface Context {
        vaultProxyPid?: number;
        vaultProxyPort?: number;
      }
      return parentTask.newListr<Context>([
        {
          title: "Verify access",
          task: async () => {
            await getIdentity({ context, profile: awsProfile });
          },
        },
        {
          title: "Start Vault Proxy",
          task: async (ctx) => {
            const { pid, port } = await startVaultProxy({
              env: {
                ...process.env,
                VAULT_TOKEN: vaultRootToken,
              },
              modulePath: join(clusterPath, MODULES.KUBE_CERT_MANAGER),
            });
            ctx.vaultProxyPid = pid;
            ctx.vaultProxyPort = port;
          },
        },
        {
          task: async (ctx, task) => {
            return task.newListr<Context>(
              [
                await buildDeployModuleTask({
                  context,
                  env: {
                    ...process.env,
                    VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                    VAULT_TOKEN: vaultRootToken,
                  },
                  environment,
                  region,
                  module: MODULES.KUBE_METRICS_SERVER,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    kubeMetricsServerTerragruntHcl
                  ).text(),
                }),
                await buildDeployModuleTask({
                  context,
                  env: {
                    ...process.env,
                    VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                    VAULT_TOKEN: vaultRootToken,
                  },
                  environment,
                  region,
                  module: MODULES.KUBE_VPA,
                  initModule: true,
                  hclIfMissing: await Bun.file(kubeVpaTerragruntHcl).text(),
                }),
              ],
              { ctx }
            );
          },
        },
        {
          title: "Enabling Vertical Pod Autoscaler",
          task: async () => {
            await upsertConfigValues({
              context,
              filePath: join(clusterPath, "region.yaml"),
              values: {
                extra_inputs: {
                  vpa_enabled: true,
                },
              },
            });
          },
        },
        {
          title: "Applying VPA to all modules",
          task: async (ctx, task) => {
            await terragruntApplyAll({
              context,
              environment,
              region,
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                VAULT_TOKEN: vaultRootToken,
              },
              task,
            });
          },
          rendererOptions: {
            outputBar: 5,
          },
        },
        {
          task: async (ctx, task) => {
            return task.newListr<Context>(
              [
                await buildDeployModuleTask({
                  context,
                  env: {
                    ...process.env,
                    VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                    VAULT_TOKEN: vaultRootToken,
                  },
                  environment,
                  region,
                  module: MODULES.KUBE_KARPENTER,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    kubeKarpenterTerragruntHcl
                  ).text(),
                }),
                await buildDeployModuleTask({
                  context,
                  env: {
                    ...process.env,
                    VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                    VAULT_TOKEN: vaultRootToken,
                  },
                  environment,
                  region,
                  module: MODULES.KUBE_KARPENTER_NODE_POOLS,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    kubeKarpenterNodePoolsTerragruntHcl
                  ).text(),
                  inputUpdates: {
                    node_subnets: defineInputUpdate({
                      schema: z.array(z.string()),
                      update: () =>
                        slaTarget === 1
                          ? ["PRIVATE_A"]
                          : ["PRIVATE_A", "PRIVATE_B", "PRIVATE_C"],
                    }),
                  },
                }),
                await buildDeployModuleTask({
                  taskTitle: "EKS NodePools Adjustment",
                  context,
                  env: {
                    ...process.env,
                    VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                    VAULT_TOKEN: vaultRootToken,
                  },
                  environment,
                  region,
                  module: MODULES.AWS_EKS,
                  inputUpdates: {
                    bootstrap_mode_enabled: defineInputUpdate({
                      schema: z.boolean(),
                      update: () => false,
                    }),
                  },
                }),
                await buildDeployModuleTask({
                  context,
                  env: {
                    ...process.env,
                    VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                    VAULT_TOKEN: vaultRootToken,
                  },
                  environment,
                  region,
                  module: MODULES.KUBE_SCHEDULER,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    kubeSchedulerTerragruntHcl
                  ).text(),
                }),
              ],
              { ctx }
            );
          },
        },
        {
          title: "Enable Bin Packing Scheduler",
          task: async () => {
            await upsertConfigValues({
              context,
              filePath: join(clusterPath, "region.yaml"),
              values: {
                extra_inputs: {
                  panfactum_scheduler_enabled: true,
                },
              },
            });
          },
        },
        {
          title: "Applying Bin Packing Scheduler to all modules",
          task: async (ctx, task) => {
            await terragruntApplyAll({
              context,
              environment,
              region,
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                VAULT_TOKEN: vaultRootToken,
              },
              task,
            });
          },
          rendererOptions: {
            outputBar: 5,
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
    throw new CLIError("Failed to setup Autoscaling", e);
  }
}
