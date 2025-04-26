import { Listr } from "listr2";
import kubeCiliumTerragruntHcl from "@/templates/kube_cilium_terragrunt.hcl" with { type: "file" };
import kubeCoreDnsTerragruntHcl from "@/templates/kube_core_dns_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask } from "@/util/terragrunt/tasks/deployModuleTask";
import type { InstallClusterStepOptions } from "./common";

export async function setupInternalClusterNetworking(
  options: InstallClusterStepOptions,
  completed: boolean
) {
  const { awsProfile, context, environment, region } = options;

  const tasks = new Listr([]);

  tasks.add({
    skip: () => completed,
    title: "Deploy Internal Cluster Networking",
    task: async (_, parentTask) => {
      return parentTask.newListr([
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
          module: MODULES.KUBE_CILIUM,
          initModule: true,
          hclIfMissing: await Bun.file(kubeCiliumTerragruntHcl).text(),
        }),
        await buildDeployModuleTask({
          taskTitle: "Deploy Core DNS",
          context,
          environment,
          region,
          module: MODULES.KUBE_CORE_DNS,
          initModule: true,
          hclIfMissing: await Bun.file(kubeCoreDnsTerragruntHcl).text(),
        }),
      ]);
    },
  });

  try {
    await tasks.run();
  } catch (e) {
    throw new CLIError("Failed to deploy internal cluster networking", e);
  }
}
