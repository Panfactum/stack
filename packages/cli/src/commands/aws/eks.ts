import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { apply } from "../terragrunt/apply";
import { initModules } from "../terragrunt/init-modules";
import type { BaseContext } from "clipanion";

export interface EksSetupInput {
  context: BaseContext;
  verbose?: boolean;
  clusterName: string;
  clusterDescription: string;
  slaLevel: 1 | 2 | 3;
}

export async function setupEks(input: EksSetupInput) {
  const templateName =
    input.slaLevel === 1
      ? "aws_eks_sla_1_terragrunt.hcl"
      : "aws_eks_sla_2_terragrunt.hcl";

  await ensureFileExists({
    context: input.context,
    destinationFile: "./aws_eks/terragrunt.hcl",
    sourceFile: await Bun.file(
      import.meta.dir + `/templates/${templateName}`
    ).text(),
  });

  await replaceHclValue(
    "./aws_eks/terragrunt.hcl",
    "cluster_name",
    input.clusterName
  );

  await replaceHclValue(
    "./aws_eks/terragrunt.hcl",
    "cluster_description",
    input.clusterDescription
  );

  initModules({
    context: input.context,
    verbose: input.verbose,
    workingDirectory: "./aws_eks",
  });

  apply({
    context: input.context,
    verbose: input.verbose,
    workingDirectory: "./aws_eks",
  });
}
