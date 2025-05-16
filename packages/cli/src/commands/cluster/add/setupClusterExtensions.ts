import { join } from "node:path";
import { z } from "zod";
import kubeBastionTerragruntHcl from "@/templates/kube_bastion_terragrunt.hcl" with { type: "file" };
import postgresTerragruntHcl from "@/templates/kube_cloudnative_pg_terragrunt.hcl" with { type: "file" };
import kubeDeschedulerTerragruntHcl from "@/templates/kube_descheduler_terragrunt.hcl" with { type: "file" };
import kubeExternalSnapshotterTerragruntHcl from "@/templates/kube_external_snapshotter_terragrunt.hcl" with { type: "file" };
import kubeKedaTerragruntHcl from "@/templates/kube_keda_terragrunt.hcl" with { type: "file" };
import kubeNodeImageCacheControllerTerragruntHcl from "@/templates/kube_node_image_cache_controller_terragrunt.hcl" with { type: "file" };
import kubePvcAutoresizerTerragruntHcl from "@/templates/kube_pvc_autoresizer_terragrunt.hcl" with { type: "file" };
import kubeReloaderTerragruntHcl from "@/templates/kube_reloader_terragrunt.hcl" with { type: "file" };
import kubeVeleroTerragruntHcl from "@/templates/kube_velero_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import {getPanfactumConfig} from "@/util/config/getPanfactumConfig.ts";
import { buildSyncSSHTask } from "@/util/devshell/tasks/syncSSHTask";
import { BASTION_SUBDOMAIN } from "@/util/domains/consts";
import { MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupClusterExtensions(
  options: InstallClusterStepOptions,
  mainTask: PanfactumTaskWrapper
) {
  const { awsProfile, context, environment, clusterPath, region } =
    options;

  const config = await getPanfactumConfig({
    context,
    directory: options.clusterPath,
  });

  if (config.kube_domain === undefined) {
    throw new Error("Kube domain is not set in the config.");
  }

  const bastionDomain = `${BASTION_SUBDOMAIN}.${config.kube_domain}`;

  const shouldSkipNodePoolsAdjustment = async () => {
    const eksModuleInfo = await readYAMLFile({
      filePath: join(clusterPath, MODULES.AWS_EKS, "module.yaml"),
      context,
      validationSchema: z.object({
        extra_inputs: z.object({
          bootstrap_mode_enabled: z.boolean(),
        }),
      }),
    });

    const eksPfData = await getModuleStatus({
      environment,
      region,
      module: MODULES.AWS_EKS,
      context,
    });

    return eksPfData.deploy_status === "success" && eksModuleInfo?.extra_inputs?.bootstrap_mode_enabled === false;
  }

  interface Context {
    vaultProxyPid?: number;
    vaultProxyPort?: number;
  }

  const tasks = mainTask.newListr<Context>([
    {
      title: "Verify access",
      task: async () => {
        await getIdentity({ context, profile: awsProfile });
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
                      taskTitle: "Deploy Bastion",
                      context,
                      env: {
                        ...process.env,
                      },
                      environment,
                      region,
                      skipIfAlreadyApplied: true,
                      module: MODULES.KUBE_BASTION,
                      inputUpdates: {
                        bastion_domains: defineInputUpdate({
                          schema: z.array(z.string()),
                          update: (_) => {
                            return [bastionDomain];
                          },
                        })
                      },
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
            {
              task: async (ctx, parentTask) => {
                return parentTask.newListr(
                  [
                    await buildDeployModuleTask({
                      taskTitle: "Deploy External Snapshotter",
                      context,
                      env: {
                        ...process.env,
                      },
                      environment,
                      region,
                      skipIfAlreadyApplied: true,
                      module: MODULES.KUBE_EXTERNAL_SNAPSHOTTER,
                      hclIfMissing: await Bun.file(
                        kubeExternalSnapshotterTerragruntHcl
                      ).text(),
                    }),
                    await buildDeployModuleTask({
                      taskTitle: "Deploy Velero",
                      context,
                      env: {
                        ...process.env,
                      },
                      environment,
                      region,
                      skipIfAlreadyApplied: true,
                      module: MODULES.KUBE_VELERO,
                      hclIfMissing: await Bun.file(
                        kubeVeleroTerragruntHcl
                      ).text(),
                    }),
                  ],
                  { ctx, concurrent: false }
                );
              },
            },
            await buildDeployModuleTask({
              taskTitle: "Deploy KEDA",
              context,
              env: {
                ...process.env,
              },
              environment,
              region,
              skipIfAlreadyApplied: true,
              module: MODULES.KUBE_KEDA,
              hclIfMissing: await Bun.file(kubeKedaTerragruntHcl).text(),
            }),
            await buildDeployModuleTask({
              taskTitle: "Deploy Reloader",
              context,
              env: {
                ...process.env,
              },
              environment,
              region,
              skipIfAlreadyApplied: true,
              module: MODULES.KUBE_RELOADER,
              hclIfMissing: await Bun.file(
                kubeReloaderTerragruntHcl
              ).text(),
            }),
            await buildDeployModuleTask({
              taskTitle: "Deploy Node Image Cache Controller",
              context,
              env: {
                ...process.env,
              },
              environment,
              region,
              skipIfAlreadyApplied: true,
              module: MODULES.KUBE_NODE_IMAGE_CACHE_CONTROLLER,
              hclIfMissing: await Bun.file(
                kubeNodeImageCacheControllerTerragruntHcl
              ).text(),
            }),
            await buildDeployModuleTask({
              taskTitle: "Deploy PVC Autoresizer",
              context,
              env: {
                ...process.env,
              },
              environment,
              region,
              skipIfAlreadyApplied: true,
              module: MODULES.KUBE_PVC_AUTORESIZER,
              hclIfMissing: await Bun.file(
                kubePvcAutoresizerTerragruntHcl
              ).text(),
            }),
            await buildDeployModuleTask({
              taskTitle: "Deploy Descheduler",
              context,
              env: {
                ...process.env,
              },
              environment,
              region,
              skipIfAlreadyApplied: true,
              module: MODULES.KUBE_DESCHEDULER,
              hclIfMissing: await Bun.file(
                kubeDeschedulerTerragruntHcl
              ).text(),
            }),
            await buildDeployModuleTask({
              taskTitle: "Deploy PostgreSQL via CloudNativePG",
              context,
              env: {
                ...process.env,
              },
              environment,
              region,
              skipIfAlreadyApplied: true,
              module: MODULES.KUBE_CLOUDNATIVE_PG,
              hclIfMissing: await Bun.file(postgresTerragruntHcl).text(),
            }),
            await buildDeployModuleTask({
              taskTitle: "EKS NodePools Adjustment",
              context,
              env: {
                ...process.env,
              },
              environment,
              region,
              skipIfAlreadyApplied: await shouldSkipNodePoolsAdjustment(),
              module: MODULES.AWS_EKS,
              inputUpdates: {
                bootstrap_mode_enabled: defineInputUpdate({
                  schema: z.boolean(),
                  update: () => false,
                }),
              },
            })
          ],
          { ctx, concurrent: true }
        );
      },
    },
  ])

  return tasks;
}
