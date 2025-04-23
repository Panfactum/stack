import { join } from "node:path";
import { Listr } from "listr2";
import { z } from "zod";
import awsLbController from "@/templates/kube_aws_lb_controller_terragrunt.hcl" with { type: "file" };
import kubeBastionTerragruntHcl from "@/templates/kube_bastion_terragrunt.hcl" with { type: "file" };
import postgresTerragruntHcl from "@/templates/kube_cloudnative_pg_terragrunt.hcl" with { type: "file" };
import kubeDeschedulerTerragruntHcl from "@/templates/kube_descheduler_terragrunt.hcl" with { type: "file" };
import kubeExternalDnsTerragruntHcl from "@/templates/kube_external_dns_terragrunt.hcl" with { type: "file" };
import kubeExternalSnapshotterTerragruntHcl from "@/templates/kube_external_snapshotter_terragrunt.hcl" with { type: "file" };
import kubeKedaTerragruntHcl from "@/templates/kube_keda_terragrunt.hcl" with { type: "file" };
import kubeNodeImageCacheControllerTerragruntHcl from "@/templates/kube_node_image_cache_controller_terragrunt.hcl" with { type: "file" };
import kubePvcAutoresizerTerragruntHcl from "@/templates/kube_pvc_autoresizer_terragrunt.hcl" with { type: "file" };
import kubeReloaderTerragruntHcl from "@/templates/kube_reloader_terragrunt.hcl" with { type: "file" };
import kubeVeleroTerragruntHcl from "@/templates/kube_velero_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { buildSyncSSHTask } from "@/util/devshell/tasks/syncSSHTask";
import { CLIError } from "@/util/error/error";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { killBackgroundProcess } from "@/util/subprocess/killBackgroundProcess";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { MODULES } from "@/util/terragrunt/constants";
import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import type { InstallClusterStepOptions } from "./common";

export async function setupSupportServices(
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
    title: "Deploy CSI Drivers",
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
              modulePath: join(clusterPath, MODULES.KUBE_AWS_LB_CONTROLLER),
            });
            ctx.vaultProxyPid = pid;
            ctx.vaultProxyPort = port;
          },
        },
        {
          task: async (ctx, parentTask) => {
            return parentTask.newListr(
              [
                {
                  task: async (ctx, parentTask) => {
                    return parentTask.newListr(
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
                          module: MODULES.KUBE_AWS_LB_CONTROLLER,
                          initModule: true,
                          hclIfMissing: await Bun.file(awsLbController).text(),
                          inputUpdates: {
                            subneets: defineInputUpdate({
                              schema: z.array(z.string()),
                              update: () =>
                                slaTarget === 1
                                  ? ["PUBLIC_A", "PUBLIC_B"]
                                  : ["PUBLIC_A", "PUBLIC_B", "PUBLIC_C"],
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
                          module: MODULES.KUBE_BASTION,
                          initModule: true,
                          hclIfMissing: await Bun.file(
                            kubeBastionTerragruntHcl
                          ).text(),
                        }),
                        {
                          title: "Configuring Bastion Connectivity",
                          task: async () => {
                            await buildSyncSSHTask({
                              context,
                            });
                          },
                        },
                      ],
                      { ctx, concurrent: false }
                    );
                  },
                },
                await buildDeployModuleTask({
                  context,
                  env: {
                    ...process.env,
                    VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                    VAULT_TOKEN: vaultRootToken,
                  },
                  environment,
                  region,
                  module: MODULES.KUBE_KEDA,
                  initModule: true,
                  hclIfMissing: await Bun.file(kubeKedaTerragruntHcl).text(),
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
                  module: MODULES.KUBE_RELOADER,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    kubeReloaderTerragruntHcl
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
                  module: MODULES.KUBE_NODE_IMAGE_CACHE_CONTROLLER,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    kubeNodeImageCacheControllerTerragruntHcl
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
                  module: MODULES.KUBE_PVC_AUTORESIZER,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    kubePvcAutoresizerTerragruntHcl
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
                  module: MODULES.KUBE_DESCHEDULER,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    kubeDeschedulerTerragruntHcl
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
                  module: MODULES.KUBE_EXTERNAL_SNAPSHOTTER,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    kubeExternalSnapshotterTerragruntHcl
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
                  module: MODULES.KUBE_VELERO,
                  initModule: true,
                  hclIfMissing: await Bun.file(kubeVeleroTerragruntHcl).text(),
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
                  module: MODULES.KUBE_CLOUDNATIVE_PG,
                  initModule: true,
                  hclIfMissing: await Bun.file(postgresTerragruntHcl).text(),
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
                  module: MODULES.KUBE_EXTERNAL_DNS,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    kubeExternalDnsTerragruntHcl
                  ).text(),
                }),
              ],
              { ctx, concurrent: true }
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
    throw new CLIError("Failed to deploy Support Services", e);
  }
}
