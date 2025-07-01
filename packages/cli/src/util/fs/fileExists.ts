// This file provides utilities for checking if files exist
// It uses Bun's filesystem API with proper error handling

import { CLIError } from "@/util/error/error";

/**
 * Input parameters for checking file existence
 */
interface IFileExistsInput {
  /** Path to the file to check */
  filePath: string;
}

/**
 * Checks if a file exists at the specified path
 * 
 * @remarks
 * This function verifies file existence using Bun's filesystem API.
 * Unlike directoryExists, this function throws errors for filesystem
 * access issues rather than returning false, providing better error
 * diagnostics.
 * 
 * Key behaviors:
 * - Returns true if the file exists
 * - Returns false if the file doesn't exist
 * - Throws error for permission or access issues
 * - Works with both absolute and relative paths
 * 
 * Common use cases:
 * - Configuration file validation
 * - Pre-operation file checks
 * - Conditional file processing
 * - Build artifact verification
 * 
 * @param input - File path configuration
 * @returns True if file exists, false otherwise
 * 
 * @example
 * ```typescript
 * // Check for configuration file
 * const configExists = await fileExists({ 
 *   filePath: './panfactum.yaml' 
 * });
 * 
 * if (!configExists) {
 *   console.log('Creating default configuration...');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Validate required file
 * const lockFile = './terraform.lock.hcl';
 * if (!await fileExists({ filePath: lockFile })) {
 *   throw new CLIError('Lock file missing - run terraform init');
 * }
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when filesystem access fails (not for missing files)
 * 
 * @see {@link Bun.file} - Bun's file API used internally
 * @see {@link directoryExists} - For checking directories
 */
export const fileExists = async (input: IFileExistsInput) => {
  const { filePath } = input;
  try {
    return await Bun.file(filePath).exists();
  } catch (e) {
    throw new CLIError(`Unable to check file existence for ${filePath}`, e)
  }
};
