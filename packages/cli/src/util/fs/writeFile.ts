// This file provides utilities for writing files to the filesystem
// It handles directory creation and overwrite protection

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { CLIError } from "@/util/error/error";
import { fileExists } from "./fileExists";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Options for writing a file to the filesystem
 */
interface IWriteFileInput {
  /** Panfactum context for logging */
  context: PanfactumContext;
  /** Path where the file should be written */
  filePath: string;
  /** Content to write to the file */
  contents: string;
  /** Whether to overwrite existing files (default: false) */
  overwrite?: boolean;
}

/**
 * Writes content to a file with automatic directory creation
 * 
 * @remarks
 * This function provides a safe way to write files by:
 * 1. Checking if the file already exists
 * 2. Creating parent directories if needed
 * 3. Writing content atomically
 * 4. Providing clear error messages
 * 
 * Key features:
 * - **Overwrite Protection**: Prevents accidental overwrites by default
 * - **Directory Creation**: Automatically creates parent directories
 * - **Atomic Writes**: Uses Bun's atomic write capabilities
 * - **Error Handling**: Clear messages for permission and I/O errors
 * 
 * Common use cases:
 * - Writing configuration files
 * - Saving generated code
 * - Creating status files
 * - Exporting data
 * 
 * @param input - Configuration for file writing operation
 * 
 * @example
 * ```typescript
 * // Write a new configuration file
 * await writeFile({
 *   context,
 *   filePath: '/path/to/config.yaml',
 *   contents: 'version: 1.0\nname: my-app',
 *   overwrite: false
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Update an existing file
 * await writeFile({
 *   context,
 *   filePath: '/path/to/status.json',
 *   contents: JSON.stringify({ status: 'complete' }),
 *   overwrite: true
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when file exists and overwrite is false
 * 
 * @throws {@link CLIError}
 * Throws when unable to create parent directories
 * 
 * @throws {@link CLIError}
 * Throws when unable to write file (permissions, disk space, etc.)
 * 
 * @see {@link fileExists} - For checking file existence
 * @see {@link mkdir} - For directory creation
 * @see {@link readYAMLFile} - For reading back written YAML files
 */
export async function writeFile(input: IWriteFileInput): Promise<void> {
  const { context, filePath, contents, overwrite = false } = input;
  if (await fileExists({ filePath })) {
    if (!overwrite) {
      throw new CLIError(`File already exists at ${filePath}. Use overwrite=true if you want to overwrite it without error.`)
    }
  }
  context.logger.debug(`Writing file`, { filePath });
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await Bun.write(filePath, contents);
  } catch (e) {
    throw new CLIError(`Error writing to ${filePath}`, e)
  }
  context.logger.debug(`Finished writing file`, { filePath });

}
