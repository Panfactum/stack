// This file provides utilities for parsing and validating JSON strings with Zod schemas
// It combines JSON parsing with schema validation in a single type-safe operation

import { z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";

/**
 * Parses a JSON string and validates it against a Zod schema
 * 
 * @remarks
 * This function provides a type-safe way to parse JSON data by:
 * 1. Parsing the JSON string to an object
 * 2. Validating the parsed object against a Zod schema
 * 3. Returning the validated, typed result
 * 
 * This approach ensures that:
 * - JSON syntax errors are caught and reported clearly
 * - Data structure matches expected schema
 * - TypeScript types are automatically inferred
 * - Validation errors provide detailed field-level feedback
 * 
 * Common use cases:
 * - Parsing API responses
 * - Reading configuration files
 * - Processing command output
 * - Validating user input
 * 
 * @param schema - Zod schema to validate against
 * @param jsonString - JSON string to parse
 * @returns Parsed and validated data matching the schema type
 * 
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.number(),
 *   name: z.string(),
 *   email: z.string().email()
 * });
 * 
 * const jsonStr = '{"id": 1, "name": "John", "email": "john@example.com"}';
 * const user = parseJson(UserSchema, jsonStr);
 * // user is fully typed as { id: number; name: string; email: string }
 * ```
 * 
 * @example
 * ```typescript
 * // Handle parsing errors
 * try {
 *   const data = parseJson(MySchema, invalidJson);
 * } catch (error) {
 *   if (error instanceof CLIError) {
 *     // JSON syntax error
 *   } else if (error instanceof PanfactumZodError) {
 *     // Schema validation error
 *   }
 * }
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when the JSON string is malformed or invalid
 * 
 * @throws {@link PanfactumZodError}
 * Throws when parsed data doesn't match the schema
 * 
 * @see {@link z.ZodType} - Base type for all Zod schemas
 * @see {@link PanfactumZodError} - For detailed validation errors
 */
export function parseJson<T>(schema: z.ZodType<T>, jsonString: string): T {
  let parsed: unknown;
  
  // Remove BOM if present
  const cleanedJsonString = jsonString.replace(/^\uFEFF/, '');
  
  try {
    parsed = JSON.parse(cleanedJsonString);
  } catch (error) {
    throw new CLIError("Failed to parse JSON", error);
  }

  const parseResult = schema.safeParse(parsed);
  if (!parseResult.success) {
    throw new PanfactumZodError("Invalid JSON structure", "JSON input", parseResult.error);
  }
  
  return parseResult.data;
}