import awsVpcTerragruntHcl from "../../templates/aws_vpc_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { getRepoVariables } from "../../util/scripts/get-repo-variables";
import { getTerragruntVariables } from "../../util/scripts/get-terragrunt-variables";
import { tfInit } from "../../util/scripts/tf-init";
import { vpcNetworkTest } from "../../util/scripts/vpc-network-test";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

export interface VpcSetupInput {
  context: BaseContext;
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

  context.stdout.write("Running VPC network test...\n");

  const repoVariables = await getRepoVariables({ context });
  const terragruntVariables = await getTerragruntVariables({
    context,
  });

  const modulePath = `${repoVariables.environments_dir}/${terragruntVariables.environment}/${terragruntVariables.region}/aws_vpc`;

  await vpcNetworkTest({
    context,
    modulePath,
    verbose,
  });
}
