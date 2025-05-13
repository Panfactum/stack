import awsEbsCsiDriverTerragruntHcl from "@/templates/kube_aws_ebs_csi_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask } from "@/util/terragrunt/tasks/deployModuleTask";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupCSIDrivers(
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
      taskTitle: "Deploy AWS EBS CSI Driver",
      context,
      environment,
      region,
      skipIfAlreadyApplied: true,
      module: MODULES.KUBE_AWS_EBS_CSI,
      hclIfMissing: await Bun.file(awsEbsCsiDriverTerragruntHcl).text(),
    }),
  ])
  return tasks;
}
