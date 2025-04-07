import awsVpcTerragruntHcl from "../../../../templates/aws_vpc_terragrunt.hcl" with { type: "file" };
import { checkStepCompletion } from "../../../../util/check-step-completion";
import { ensureFileExists } from "../../../../util/ensure-file-exists";
import { initAndApplyModule } from "../../../../util/init-and-apply-module";
import { replaceHclValue } from "../../../../util/replace-hcl-value";
import { getRepoVariables } from "../../../../util/scripts/get-repo-variables";
import { getTerragruntVariables } from "../../../../util/scripts/get-terragrunt-variables";
import { vpcNetworkTest } from "../../../../util/scripts/vpc-network-test";
import { updateConfigFile } from "../../../../util/update-config-file";
import type { BaseContext } from "clipanion";

export interface VpcSetupInput {
  context: BaseContext;
  configPath: string;
  vpcName: string;
  vpcDescription: string;
  verbose?: boolean;
}

export async function setupVpc({
  context,
  configPath,
  vpcName,
  vpcDescription,
  verbose,
}: VpcSetupInput) {
  let vpcIaCSetupComplete = false;
  try {
    vpcIaCSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupVpcIaC",
      stepCompleteMessage:
        "1.a. Skipping VPC infrastructure as code setup as it's already complete.\n",
      stepNotCompleteMessage: "1.a. Setting up infrastructure as code\n",
    });
  } catch {
    throw new Error("Failed to check if VPC module installation is complete");
  }

  if (!vpcIaCSetupComplete) {
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

    await initAndApplyModule({
      context,
      moduleName: "VPC",
      modulePath: "./aws_vpc",
      verbose,
    });

    await updateConfigFile({
      updates: {
        setupVpc: true,
      },
      configPath,
      context,
    });
  }

  let vpcNetworkTestComplete = false;
  try {
    vpcNetworkTestComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "vpcNetworkTest",
      stepCompleteMessage:
        "1.b. Skipping VPC network tests as they're already complete.\n",
      stepNotCompleteMessage: "1.b. Running VPC network tests\n",
    });
  } catch {
    throw new Error("Failed to check if VPC network tests are complete");
  }

  if (!vpcNetworkTestComplete) {
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

    await updateConfigFile({
      updates: {
        vpcNetworkTest: true,
      },
      configPath,
      context,
    });
  }
}
