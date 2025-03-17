import { existsSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { z } from "zod";
import { getRepoVariables } from "./get-repo-variables";
import { getModuleOutputs } from "../../commands/terragrunt/get-module-outputs";
import type { BaseContext } from "clipanion";

export const vpcNetworkTest = async ({
  context,
  modulePath,
  verbose = false,
}: {
  context: BaseContext;
  modulePath: string;
  verbose?: boolean;
}) => {
  //####################################################################
  // Step 0: Validation
  //####################################################################
  const repoVariables = await getRepoVariables({ context });

  const awsDir = repoVariables.aws_dir;
  const awsConfigFile = path.join(awsDir, "config");

  if (!existsSync(awsConfigFile)) {
    context.stderr.write(
      pc.red(`Error: No AWS config file found at ${awsConfigFile}.`)
    );
    return 1;
  }

  //####################################################################
  // Step 1: Get aws_vpc module outputs
  //####################################################################

  const moduleOuputsValidationSchema = z.object({
    test_config: z.object({
      value: z.object({
        region: z.string(),
      }),
    }),
  });

  const moduleOutputs = getModuleOutputs({
    context,
    modulePath,
    validationSchema: moduleOuputsValidationSchema,
    verbose,
  });

  //####################################################################
  // Step 2: Select AWS profile to use to run the test
  //####################################################################

  //####################################################################
  // Step 3: Run the tests
  //####################################################################

  return 0;
};
