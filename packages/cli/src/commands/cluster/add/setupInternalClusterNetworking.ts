import kubeCiliumTerragruntHcl from "@/templates/kube_cilium_terragrunt.hcl" with { type: "file" };
import kubeCoreDnsTerragruntHcl from "@/templates/kube_core_dns_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask } from "@/util/terragrunt/tasks/deployModuleTask";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupInternalClusterNetworking(
  options: InstallClusterStepOptions,
  mainTask: PanfactumTaskWrapper
) {
  const { awsProfile, context, environment, region } = options;

  const tasks = mainTask.newListr([
    {
      title: "Verify access",
      task: async () => {
        await getIdentity({ context, profile: awsProfile });
      },
    },
    await buildDeployModuleTask({
      taskTitle: "Deploy Cilium",
      context,
      environment,
      region,
      skipIfAlreadyApplied: true,
      module: MODULES.KUBE_CILIUM,
      hclIfMissing: await Bun.file(kubeCiliumTerragruntHcl).text(),
    }),
    await buildDeployModuleTask({
      taskTitle: "Deploy Core DNS",
      context,
      environment,
      region,
      skipIfAlreadyApplied: true,
      module: MODULES.KUBE_CORE_DNS,
      hclIfMissing: await Bun.file(kubeCoreDnsTerragruntHcl).text(),
    }),
  ]);

  return tasks;
}
