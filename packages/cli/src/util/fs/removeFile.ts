// This file provides utilities for safely removing files from the filesystem
// It handles file deletion with proper error handling

import { rm } from "node:fs/promises";
import { CLIError } from "@/util/error/error";

/**
 * Input parameters for removing a file
 */
interface IRemoveFileInput {
  /** Absolute path to the file to remove */
  filePath: string;
}

/**
 * Safely removes a file from the filesystem
 * 
 * @remarks
 * This function performs file deletion using Node.js's built-in `rm` function
 * with force flag enabled. It provides proper error handling and graceful
 * failure for common scenarios.
 * 
 * Key features:
 * - **Force Mode**: Continues even if the file doesn't exist
 * - **Error Handling**: Converts filesystem errors to CLI errors
 * - **Safe Operation**: Uses Node.js built-in functions for reliability
 * - **Descriptive Errors**: Includes file path in error messages
 * 
 * The function will attempt to delete the file even if it doesn't exist,
 * making it safe to call in cleanup scenarios where the file may have
 * already been removed.
 * 
 * @param input - Configuration including file path
 * 
 * @example
 * ```typescript
 * // Remove a temporary file
 * await removeFile({
 *   filePath: '/tmp/my-temp-file.txt'
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Clean up generated files
 * await removeFile({
 *   filePath: path.join(outputDir, 'generated-config.yaml')
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when file removal fails due to permissions or other filesystem errors
 * 
 * @see {@link rm} - Node.js filesystem removal function
 */
export async function removeFile({ filePath }: IRemoveFileInput): Promise<void> {
  try {
    await rm(filePath, { force: true });
  } catch (error) {
    throw new CLIError(`Unable to delete file at ${filePath}`, error);
  }
}