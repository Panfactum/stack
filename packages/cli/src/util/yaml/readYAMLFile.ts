// This file provides utilities for reading and validating YAML files
// It combines file reading, YAML parsing, and schema validation

import { parse } from "yaml";
import { z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for reading and validating YAML files
 */
interface IReadYAMLFileInput<T extends z.ZodType<object>> {
    /** Panfactum context for logging */
    context: PanfactumContext;
    /** Path to the YAML file to read */
    filePath: string;
    /** Zod schema for validating the parsed content */
    validationSchema: T;
    /** Whether to throw error if file doesn't exist (default: true) */
    throwOnMissing?: boolean;
    /** Whether to throw error if file is empty (default: true) */
    throwOnEmpty?: boolean;
}

/**
 * Reads and validates a YAML file against a Zod schema
 * 
 * @remarks
 * This function provides a comprehensive YAML file reading solution:
 * 
 * 1. **File Checks**: Verifies file existence and content
 * 2. **YAML Parsing**: Parses YAML content to JavaScript objects
 * 3. **Schema Validation**: Validates parsed data against Zod schema
 * 4. **Error Handling**: Provides clear errors for each failure mode
 * 
 * The function handles various edge cases:
 * - Missing files (configurable behavior)
 * - Empty files (configurable behavior)
 * - Invalid YAML syntax
 * - Schema validation failures
 * 
 * Common use cases:
 * - Reading configuration files
 * - Loading module status files
 * - Parsing structured data files
 * - Validating user-provided YAML
 * 
 * @param input - Configuration for reading and validating the file
 * @returns Validated data matching schema type, or null if file missing/empty
 * 
 * @example
 * ```typescript
 * const ConfigSchema = z.object({
 *   version: z.string(),
 *   services: z.array(z.string())
 * });
 * 
 * const config = await readYAMLFile({
 *   context,
 *   filePath: '/path/to/config.yaml',
 *   validationSchema: ConfigSchema,
 *   throwOnMissing: true
 * });
 * 
 * if (config) {
 *   console.log(`Version: ${config.version}`);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Optional file reading
 * const status = await readYAMLFile({
 *   context,
 *   filePath: 'module.status.yaml',
 *   validationSchema: StatusSchema,
 *   throwOnMissing: false,
 *   throwOnEmpty: false
 * });
 * 
 * // Returns null if file doesn't exist or is empty
 * const currentStatus = status ?? getDefaultStatus();
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
 * Throws when YAML syntax is invalid
 * 
 * @throws {@link PanfactumZodError}
 * Throws when parsed data doesn't match the schema
 * 
 * @see {@link writeYAMLFile} - For writing YAML files
 * @see {@link parse} - YAML parsing library
 */
export const readYAMLFile = async <T extends z.ZodType<object>>(
    input: IReadYAMLFileInput<T>
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
    context.logger.debug(`Reading yaml file`, { filePath });
    const fileContent = await Bun.file(filePath).text()
        .catch((error: unknown) => {
            throw new CLIError(`Unable to read file at ${filePath}`, error);
        });
    context.logger.debug(`Finished reading yaml file`, { filePath });

    // Check if file is empty
    if (!fileContent || fileContent.trim().length === 0) {
        if (throwOnEmpty) {
            throw new CLIError(`File is empty at ${filePath}`);
        }
        return null;
    }

    // Parse YAML
    let parsedYaml: unknown;
    try {
        parsedYaml = parse(fileContent);
    } catch (error) {
        throw new CLIError(`Invalid YAML syntax in file at ${filePath}`, error);
    }

    // Check if parsed content is null/undefined
    if (parsedYaml === null || parsedYaml === undefined) {
        if (throwOnEmpty) {
            throw new CLIError(`File is empty at ${filePath}`);
        }
        return null;
    }

    // Validate with schema
    context.logger.debug(`Validating`, { filePath });
    const parseResult = validationSchema.safeParse(parsedYaml);
    if (!parseResult.success) {
        throw new PanfactumZodError("Invalid values in yaml file", filePath, parseResult.error);
    }

    return parseResult.data as z.infer<T>;
};
