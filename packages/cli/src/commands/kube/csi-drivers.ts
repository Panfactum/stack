import awsEbsCsiDriverTerragruntHcl from "../../templates/kube_aws_ebs_csi_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { tfInit } from "../../util/scripts/tf-init";
import { apply } from "../terragrunt/apply";
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

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_aws_ebs_csi",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_aws_ebs_csi",
  });
}
