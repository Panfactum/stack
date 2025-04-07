import awsEbsCsiDriverTerragruntHcl from "../../../../templates/kube_aws_ebs_csi_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../../../util/ensure-file-exists";
import { initAndApplyModule } from "../../../../util/init-and-apply-module";
import type { BaseContext } from "clipanion";

export async function setupCSIDrivers({
  context,
  verbose,
}: {
  context: BaseContext;
  verbose?: boolean;
}) {
  // https://panfactum.com/docs/edge/guides/bootstrapping/storage-interfaces#deploy-aws-ebs-csi-driver
  context.stdout.write("6.a. Setting up AWS EBS CSI driver\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_aws_ebs_csi/terragrunt.hcl",
    sourceFile: await Bun.file(awsEbsCsiDriverTerragruntHcl).text(),
  });

  await initAndApplyModule({
    context,
    moduleName: "AWS EBS CSI Driver",
    modulePath: "./kube_aws_ebs_csi",
    verbose,
  });
}
