// This file provides utilities for handling parse errors
// It helps convert generic errors into structured Panfactum errors

import { ZodError } from "zod";
import { PanfactumZodError, CLIError } from "./error";

/**
 * Interface for parseErrorHandler input parameters
 */
interface IParseErrorHandlerInput {
  /** The error that occurred during parsing */
  error: unknown;
  /** Primary error message to display */
  errorMessage: string;
  /** Alternative message for non-Zod errors */
  nonZodErrorMessage?: string;
  /** Location where the error occurred (e.g., file path) */
  location: string;
}

/**
 * Handles parse errors and converts them to appropriate Panfactum error types
 * 
 * @remarks
 * This function examines the error type and returns either a PanfactumZodError
 * for Zod validation failures or a generic CLIError for other error types.
 * This provides consistent error handling across the CLI.
 * 
 * @param input - The error and context information
 * @returns Either a PanfactumZodError or CLIError based on the error type
 * 
 * @example
 * ```typescript
 * try {
 *   const data = schema.parse(jsonData);
 * } catch (error) {
 *   throw parseErrorHandler({
 *     error,
 *     errorMessage: 'Failed to parse configuration',
 *     nonZodErrorMessage: 'Configuration file is malformed',
 *     location: '/path/to/config.json'
 *   });
 * }
 * ```
 * 
 * @see {@link PanfactumZodError} - For Zod validation errors
 * @see {@link CLIError} - For general errors
 */
export function parseErrorHandler(input: IParseErrorHandlerInput): PanfactumZodError | CLIError {
  const { error, errorMessage, nonZodErrorMessage, location } = input;
  if (error instanceof ZodError) {
    return new PanfactumZodError(errorMessage, location, error);
  } else {
    return new CLIError(nonZodErrorMessage ?? errorMessage, error);
  }
}
