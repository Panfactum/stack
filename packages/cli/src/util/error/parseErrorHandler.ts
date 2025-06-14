import { ZodError } from "zod";
import { PanfactumZodError, CLIError } from "./error";

export function parseErrorHandler({
  error,
  errorMessage,
  nonZodErrorMessage,
  location
}: {
  error: unknown;
  errorMessage: string;
  nonZodErrorMessage?: string;
  location: string;
}): PanfactumZodError | CLIError {
  if (error instanceof ZodError) {
    return new PanfactumZodError(errorMessage, location, error);
  } else {
    return new CLIError(nonZodErrorMessage ?? errorMessage, error);
  }
}
