import { z, ZodError } from "zod";
import { CLIError, PanfactumZodError } from "../error/error";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

export const terragruntOutput = async <T extends z.ZodType<object>>({
  context,
  modulePath,
  validationSchema,
}: {
  context: PanfactumContext;
  modulePath: string;
  validationSchema: T;
}) => {

  // TODO: @seth You MUST verify that the user is logged in before running this command


  const {stdout} = await execute({
    command: ["terragrunt", "output", "--json"],
    workingDirectory: modulePath,
    context,
    errorMessage: "Failed to get outputs from infrastructure module"
  })

  try {
    return validationSchema.parse(JSON.parse(stdout)) as z.infer<T>
  } catch (e) {
    if (e instanceof ZodError) {
      throw new PanfactumZodError(`Unexpected outputs from infrastructure module`, modulePath, e)
    } else {
      throw new CLIError(`Unable to parse outputs from infrastructure module at ${modulePath}.`, e)
    }
  }
};
