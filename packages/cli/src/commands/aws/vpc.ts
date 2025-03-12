import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { apply } from "../terragrunt/apply";
import { initModules } from "../terragrunt/init-modules";
import type { BaseContext } from "clipanion";

export interface VpcSetupInput {
  context: BaseContext;
  vpcName: string;
  vpcDescription: string;
  verbose?: boolean;
}

export async function setupVpc(input: VpcSetupInput) {
  await ensureFileExists({
    context: input.context,
    downloadUrl: `https://raw.githubusercontent.com/Panfactum/stack/refs/tags/edge.25-03-04/packages/reference/environments/production/us-east-2/aws_vpc/terragrunt.hcl`,
    filePath: "./aws_vpc/terragrunt.hcl",
  });

  await replaceHclValue("./aws_vpc/terragrunt.hcl", "vpc_name", input.vpcName);

  await replaceHclValue(
    "./aws_vpc/terragrunt.hcl",
    "vpc_description",
    input.vpcDescription
  );

  initModules({
    context: input.context,
    verbose: input.verbose,
    workingDirectory: "./aws_vpc",
  });

  apply({
    context: input.context,
    verbose: input.verbose,
    workingDirectory: "./aws_vpc",
  });
}
