import awsVpcTerragruntHcl from "../../templates/aws_vpc_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { tfInit } from "../../util/scripts/tf-init";
import { vpcNetworkTest } from "../../util/scripts/vpc-network-test";
import { apply } from "../terragrunt/apply";
import { getPanfactumConfig } from "../config/get/getPanfactumConfig";
import type { PanfactumContext } from "../../context";

export interface VpcSetupInput {
  context: PanfactumContext;
  vpcName: string;
  vpcDescription: string;
  verbose?: boolean;
}

export async function setupVpc({
  context,
  vpcName,
  vpcDescription,
  verbose,
}: VpcSetupInput) {
  await ensureFileExists({
    context,
    destinationFile: "./aws_vpc/terragrunt.hcl",
    sourceFile: await Bun.file(awsVpcTerragruntHcl).text(),
  });

  await replaceHclValue("./aws_vpc/terragrunt.hcl", "vpc_name", vpcName);

  await replaceHclValue(
    "./aws_vpc/terragrunt.hcl",
    "vpc_description",
    vpcDescription
  );

  context.stdout.write("1.a. Setting up infrastructure as code\n");

  tfInit({
    context,
    verbose,
    workingDirectory: "./aws_vpc",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./aws_vpc",
  });

  context.stdout.write("1.b. Running VPC network tests\n");
  const terragruntVariables = await getPanfactumConfig({
    context,
  });

  const modulePath = `${context.repoVariables.environments_dir}/${terragruntVariables.environment}/${terragruntVariables.region}/aws_vpc`;

  await vpcNetworkTest({
    context,
    modulePath,
    verbose,
  });
}
