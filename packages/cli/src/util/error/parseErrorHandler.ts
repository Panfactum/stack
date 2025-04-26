import { ZodError } from "zod";
import { PanfactumZodError, CLIError } from "./error";

export function parseErrorHandler({
  error,
  errorMessage,
  nonZodErrorMessage,
  command,
}: {
  error: unknown;
  errorMessage: string;
  nonZodErrorMessage?: string;
  command: string;
}) {
  if (error instanceof ZodError) {
    throw new PanfactumZodError(errorMessage, command, error);
  } else {
    throw new CLIError(nonZodErrorMessage ?? errorMessage, error);
  }
}
