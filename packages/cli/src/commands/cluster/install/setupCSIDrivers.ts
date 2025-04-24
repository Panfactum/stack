import { Listr } from "listr2";
import awsEbsCsiDriverTerragruntHcl from "@/templates/kube_aws_ebs_csi_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask } from "@/util/terragrunt/tasks/deployModuleTask";
import type { InstallClusterStepOptions } from "./common";

export async function setupCSIDrivers(
  options: InstallClusterStepOptions,
  completed: boolean
) {
  const { awsProfile, context, environment, region } = options;

  const tasks = new Listr([]);

  tasks.add({
    skip: () => completed,
    title: "Deploy CSI Drivers",
    task: async (_, parentTask) => {
      return parentTask.newListr([
        {
          title: "Verify access",
          task: async () => {
            await getIdentity({ context, profile: awsProfile });
          },
        },
        await buildDeployModuleTask({
          context,
          environment,
          region,
          module: MODULES.KUBE_AWS_EBS_CSI,
          initModule: true,
          hclIfMissing: await Bun.file(awsEbsCsiDriverTerragruntHcl).text(),
        }),
      ]);
    },
  });

  try {
    await tasks.run();
  } catch (e) {
    throw new CLIError("Failed to deploy CSI drivers", e);
  }
}
