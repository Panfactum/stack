import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { apply } from "../terragrunt/apply";
import { initModules } from "../terragrunt/init-modules";
import type { BaseContext } from "clipanion";

export interface VpcSetupInput {
  context: BaseContext;
  pfStackVersion: string;
  vpcName: string;
  vpcDescription: string;
  verbose?: boolean;
}

export async function setupVpc(input: VpcSetupInput) {
  await ensureFileExists({
    context: input.context,
    destinationFile: "./aws_vpc/terragrunt.hcl",
    sourceFile: await Bun.file(
      import.meta.dir + "/templates/aws_vpc_terragrunt.hcl"
    ).text(),
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
