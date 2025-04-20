import awsEbsCsiDriverTerragruntHcl from "@/templates/kube_aws_ebs_csi_terragrunt.hcl" with { type: "file" };
import { deployModule } from "./deployModule";
import type { InstallClusterStepOptions } from "./common";

export async function setupCSIDrivers(options: InstallClusterStepOptions) {
  const { stepNum } = options;

  /***************************************************
   * Deploy the EBS CSI Module
   ***************************************************/
  await deployModule({
    ...options,
    stepId: "awsEBSCSIDriver",
    stepName: "AWS EBS CSI Driver",
    module: "kube_aws_ebs_csi",
    terraguntContents: awsEbsCsiDriverTerragruntHcl,
    stepNum: stepNum,
    subStepNum: 1,
  });
}
