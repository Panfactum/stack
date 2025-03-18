import awsVpcTerragruntHcl from "../../templates/aws_vpc_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { tfInit } from "../../util/scripts/tf-init";
import { apply } from "../terragrunt/apply";
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
    sourceFile: await Bun.file(awsVpcTerragruntHcl).text(),
  });

  await replaceHclValue("./aws_vpc/terragrunt.hcl", "vpc_name", input.vpcName);

  await replaceHclValue(
    "./aws_vpc/terragrunt.hcl",
    "vpc_description",
    input.vpcDescription
  );

  tfInit({
    context: input.context,
    verbose: input.verbose,
    workingDirectory: "./aws_vpc",
  });

  apply({
    context: input.context,
    verbose: input.verbose,
    workingDirectory: "./aws_vpc",
  });

  // Run network connectivity tests
}
