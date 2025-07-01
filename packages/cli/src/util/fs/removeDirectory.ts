// This file provides utilities for safely removing directories from the filesystem
// It handles recursive deletion with proper error handling

import { rm } from "node:fs/promises";
import { CLIError } from "@/util/error/error";

/**
 * Input parameters for removing a directory
 */
interface IRemoveDirectoryInput {
  /** Absolute path to the directory to remove */
  dirPath: string;
}

/**
 * Safely removes a directory and all its contents from the filesystem
 * 
 * @remarks
 * This function performs a recursive directory deletion using Node.js's
 * built-in `rm` function with force and recursive flags. It provides
 * proper error handling and graceful failure for common scenarios.
 * 
 * Key features:
 * - **Recursive Deletion**: Removes all subdirectories and files
 * - **Force Mode**: Continues even if some files cannot be deleted
 * - **Error Handling**: Converts filesystem errors to CLI errors
 * - **Safe Operation**: Uses Node.js built-in functions for reliability
 * 
 * The function will attempt to delete the directory even if it doesn't
 * exist, making it safe to call in cleanup scenarios where the directory
 * may have already been removed.
 * 
 * @param input - Configuration including directory path
 * 
 * @example
 * ```typescript
 * // Remove a temporary directory
 * await removeDirectory({
 *   dirPath: '/tmp/my-temp-dir'
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Clean up build artifacts
 * await removeDirectory({
 *   dirPath: path.join(projectRoot, 'dist')
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when directory removal fails due to permissions or other filesystem errors
 * 
 * @see {@link rm} - Node.js filesystem removal function
 */
export async function removeDirectory({ dirPath }: IRemoveDirectoryInput): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    throw new CLIError("Unable to delete directory", error);
  }
}