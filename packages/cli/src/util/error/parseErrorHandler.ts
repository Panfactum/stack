import { ZodError } from "zod";
import { PanfactumZodError, CLIError } from "./error";

export function parseErrorHandler({
  error,
  zodErrorMessage,
  genericErrorMessage,
  command,
}: {
  error: unknown;
  zodErrorMessage: string;
  genericErrorMessage: string;
  command: string;
}) {
  if (error instanceof ZodError) {
    throw new PanfactumZodError(zodErrorMessage, command, error);
  } else {
    throw new CLIError(genericErrorMessage, error);
  }
}
