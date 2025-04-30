import { join } from "node:path"
import { z, ZodError } from "zod";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import { getIdentity } from "../aws/getIdentity";
import { CLIError, PanfactumZodError } from "../error/error";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

export const terragruntOutput = async <T extends z.ZodType<object>>({
  awsProfile,
  context,
  environment,
  region,
  module,
  validationSchema,
}: {
  awsProfile?: string;
  context: PanfactumContext;
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
    workingDirectory,
    context,
    errorMessage: "Failed to get outputs from infrastructure module",
  });

  try {
    return validationSchema.parse(JSON.parse(stdout)) as z.infer<T>;
  } catch (e) {
    if (e instanceof ZodError) {
      throw new PanfactumZodError(
        `Unexpected outputs from infrastructure module`,
        workingDirectory,
        e
      );
    } else {
      throw new CLIError(
        `Unable to parse outputs from infrastructure module at ${workingDirectory}.`,
        e
      );
    }
  }
};
