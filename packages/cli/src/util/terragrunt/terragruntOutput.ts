import { z, ZodError } from "zod";
import { CLIError, PanfactumZodError } from "../error/error";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

export const terragruntOutput = async <T extends z.ZodType<object>>({
  awsProfile,
  context,
  modulePath,
  validationSchema,
}: {
  awsProfile: string;
  context: PanfactumContext;
  modulePath: string;
  validationSchema: T;
}) => {
  const { exitCode } = await execute({
    command: ["aws", "sts", "get-caller-identity", "--profile", awsProfile],
    workingDirectory: modulePath,
    context,
  });

  if (exitCode !== 0) {
    context.logger.log(
      `Not logged in to AWS with profile ${awsProfile}. Logging you in...`
    );
    const { exitCode } = await execute({
      command: ["aws", "sts", "get-caller-identity", "--profile", awsProfile],
      workingDirectory: modulePath,
      context,
      errorMessage: `Not logged in to AWS with profile ${awsProfile}.`,
    });

    if (exitCode !== 0) {
      throw new CLIError(`Unable to log in to AWS with profile ${awsProfile}.`);
    }
  }

  const { stdout } = await execute({
    command: ["terragrunt", "output", "--json"],
    workingDirectory: modulePath,
    context,
    errorMessage: "Failed to get outputs from infrastructure module",
  });

  try {
    return validationSchema.parse(JSON.parse(stdout)) as z.infer<T>;
  } catch (e) {
    if (e instanceof ZodError) {
      throw new PanfactumZodError(
        `Unexpected outputs from infrastructure module`,
        modulePath,
        e
      );
    } else {
      throw new CLIError(
        `Unable to parse outputs from infrastructure module at ${modulePath}.`,
        e
      );
    }
  }
};
