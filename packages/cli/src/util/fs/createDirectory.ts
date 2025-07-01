// This file provides utilities for creating directories in the filesystem
// It ensures directories are created with proper error handling

import { mkdir } from "node:fs/promises";
import { CLIError } from "@/util/error/error";

/**
 * Input parameters for creating a directory
 */
interface ICreateDirectoryInput {
  /** Absolute or relative path to the directory to create */
  dirPath: string;
}

/**
 * Creates a directory at the specified path
 * 
 * @remarks
 * This function creates directories recursively, meaning it will create
 * all parent directories if they don't exist. This is similar to the
 * `mkdir -p` command in Unix systems.
 * 
 * Key features:
 * - Creates parent directories automatically
 * - Idempotent - safe to call on existing directories
 * - Handles both absolute and relative paths
 * - Provides clear error messages on failure
 * 
 * Common use cases:
 * - Creating configuration directories
 * - Setting up workspace directories
 * - Preparing output directories for generated files
 * - Ensuring cache directories exist
 * 
 * @param input - Configuration for directory creation
 * 
 * @example
 * ```typescript
 * // Create a single directory
 * await createDirectory({ dirPath: '/tmp/myapp' });
 * ```
 * 
 * @example
 * ```typescript
 * // Create nested directories
 * await createDirectory({ 
 *   dirPath: '/home/user/.config/panfactum/cache' 
 * });
 * // All parent directories will be created if needed
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when directory creation fails due to permissions or other filesystem errors
 * 
 * @see {@link mkdir} - Node.js filesystem API used internally
 */
export const createDirectory = async (
    input: ICreateDirectoryInput) => {
    const { dirPath } = input;
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new CLIError("Unable to create directory", error);
    }
  };