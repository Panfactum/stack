import { join } from "node:path"
import { z } from "zod";
import { getIdentity } from "@/util/aws/getIdentity";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

export const terragruntOutput = async <T extends z.ZodType<object>>({
  awsProfile,
  context,
  env,
  environment,
  region,
  module,
  validationSchema,
}: {
  awsProfile?: string;
  context: PanfactumContext;
  // todo: why are there keys that are not set to value?
  env?: Record<string, string | undefined>;
  environment: string;
  region: string;
  module: string;
  validationSchema: T;
}) => {
  const workingDirectory = join(context.repoVariables.environments_dir, environment, region, module)


  if (!awsProfile) {
    const config = await getPanfactumConfig({ context, directory: workingDirectory })
    awsProfile = config.aws_profile
  }

  if (awsProfile) {
    await getIdentity({ context, profile: awsProfile })
  }

  const { stdout } = await execute({
    command: [
      "terragrunt",
      "output",
      "--json",
      "--terragrunt-non-interactive"
    ],
    env,
    workingDirectory,
    context,
    errorMessage: "Failed to get outputs from infrastructure module",
  });

  // Parse JSON output
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(stdout);
  } catch (error) {
    throw new CLIError(
      `Invalid JSON output from infrastructure module at ${workingDirectory}`,
      error
    );
  }

  // Validate output structure
  const parseResult = validationSchema.safeParse(parsedOutput);
  if (!parseResult.success) {
    throw new PanfactumZodError(
      `Unexpected outputs from infrastructure module`,
      workingDirectory,
      parseResult.error
    );
  }

  return parseResult.data as z.infer<T>;
};
