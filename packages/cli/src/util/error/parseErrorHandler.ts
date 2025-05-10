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
}) {
  if (error instanceof ZodError) {
    throw new PanfactumZodError(errorMessage, location, error);
  } else {
    throw new CLIError(nonZodErrorMessage ?? errorMessage, error);
  }
}
