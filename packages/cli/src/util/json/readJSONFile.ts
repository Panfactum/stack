// This file provides utilities for reading and validating JSON files
// It combines file reading, JSON parsing, and schema validation

import { z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for reading and validating JSON files
 */
interface IReadJSONFileInput<T extends z.ZodType<object>> {
    /** Panfactum context for logging */
    context: PanfactumContext;
    /** Path to the JSON file to read */
    filePath: string;
    /** Zod schema for validating the parsed content */
    validationSchema: T;
    /** Whether to throw error if file doesn't exist (default: true) */
    throwOnMissing?: boolean;
    /** Whether to throw error if file is empty (default: true) */
    throwOnEmpty?: boolean;
}

/**
 * Reads and validates a JSON file against a Zod schema
 * 
 * @remarks
 * This function provides a comprehensive JSON file reading solution that
 * mirrors the functionality of readYAMLFile but for JSON format:
 * 
 * 1. **File Checks**: Verifies file existence and content
 * 2. **JSON Parsing**: Parses JSON content with error handling
 * 3. **Schema Validation**: Validates parsed data against Zod schema
 * 4. **Error Handling**: Provides clear errors for each failure mode
 * 
 * The function handles various edge cases:
 * - Missing files (configurable behavior)
 * - Empty files (configurable behavior)
 * - Invalid JSON syntax
 * - Schema validation failures
 * - File read errors (permissions, I/O)
 * 
 * Common use cases:
 * - Reading API configuration files
 * - Loading cached data
 * - Parsing command output saved as JSON
 * - Validating structured data files
 * 
 * @param input - Configuration for reading and validating the file
 * @returns Validated data matching schema type, or null if file missing/empty
 * 
 * @example
 * ```typescript
 * const ConfigSchema = z.object({
 *   apiKey: z.string(),
 *   endpoints: z.array(z.string().url()),
 *   timeout: z.number().optional()
 * });
 * 
 * const config = await readJSONFile({
 *   context,
 *   filePath: '/path/to/config.json',
 *   validationSchema: ConfigSchema,
 *   throwOnMissing: true
 * });
 * 
 * if (config) {
 *   console.log(`API Key: ${config.apiKey}`);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Optional file reading for cache
 * const CacheSchema = z.object({
 *   data: z.array(z.unknown()),
 *   timestamp: z.number()
 * });
 * 
 * const cache = await readJSONFile({
 *   context,
 *   filePath: '.cache/data.json',
 *   validationSchema: CacheSchema,
 *   throwOnMissing: false,
 *   throwOnEmpty: false
 * });
 * 
 * // Use cached data if available and fresh
 * if (cache && Date.now() - cache.timestamp < 3600000) {
 *   return cache.data;
 * }
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when file doesn't exist (if throwOnMissing is true)
 * 
 * @throws {@link CLIError}
 * Throws when unable to read file (permissions, I/O errors)
 * 
 * @throws {@link CLIError}
 * Throws when file is empty (if throwOnEmpty is true)
 * 
 * @throws {@link CLIError}
 * Throws when JSON syntax is invalid
 * 
 * @throws {@link PanfactumZodError}
 * Throws when parsed data doesn't match the schema
 * 
 * @see {@link readYAMLFile} - Similar function for YAML files
 * @see {@link parseJson} - For parsing JSON strings
 */
export const readJSONFile = async <T extends z.ZodType<object>>(
    input: IReadJSONFileInput<T>
): Promise<z.infer<T> | null> => {
    const { filePath, throwOnMissing = true, throwOnEmpty = true, validationSchema, context } = input;

    if (!(await fileExists({ filePath }))) {
        if (throwOnMissing) {
            throw new CLIError(`File does not exist at ${filePath}`);
        } else {
            return null;
        }
    }

    // Read file content
    context.logger.debug(`Reading JSON file`, { filePath });
    const fileContent = await Bun.file(filePath).text()
        .catch((error: unknown) => {
            throw new CLIError(`Unable to read file at ${filePath}`, error);
        });
    context.logger.debug(`Finished reading JSON file`, { filePath });

    // Check if file is empty
    if (!fileContent || fileContent.trim().length === 0) {
        if (throwOnEmpty) {
            throw new CLIError(`File is empty at ${filePath}`);
        }
        return null;
    }

    // Parse JSON
    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(fileContent);
    } catch (error) {
        throw new CLIError(`Invalid JSON syntax in file at ${filePath}`, error);
    }

    // Validate with schema
    context.logger.debug(`Validating JSON`, { filePath });
    const parseResult = validationSchema.safeParse(parsedJson);
    if (!parseResult.success) {
        throw new PanfactumZodError("Invalid values in JSON file", filePath, parseResult.error);
    }

    return parseResult.data as z.infer<T>;
};