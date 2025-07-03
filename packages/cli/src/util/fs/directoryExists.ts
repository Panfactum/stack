// This file provides utilities for checking if directories exist
// It uses Bun's filesystem API for efficient directory detection

/**
 * Input parameters for checking directory existence
 */
interface IDirectoryExistsInput {
  /** Path to the directory to check */
  path: string;
}

/**
 * Checks if a directory exists at the specified path
 * 
 * @remarks
 * This function safely checks for directory existence without throwing
 * errors if the path doesn't exist. It specifically verifies that the
 * path points to a directory, not just any filesystem entry.
 * 
 * Key behaviors:
 * - Returns false if the path doesn't exist
 * - Returns false if the path exists but is a file
 * - Returns true only if the path is a directory
 * - Handles errors gracefully without throwing
 * 
 * Common use cases:
 * - Validating directory paths before operations
 * - Conditional directory creation
 * - Configuration directory detection
 * - Cache directory verification
 * 
 * @param input - Path configuration
 * @returns True if directory exists, false otherwise
 * 
 * @example
 * ```typescript
 * // Check if config directory exists
 * const exists = await directoryExists({ 
 *   path: '/home/user/.config/panfactum' 
 * });
 * 
 * if (!exists) {
 *   await createDirectory({ path: '/home/user/.config/panfactum' });
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Validate module directory
 * const moduleDir = './src/modules/aws_vpc';
 * if (await directoryExists({ path: moduleDir })) {
 *   console.log('Module directory found');
 * } else {
 *   throw new CLIError('Module directory not found');
 * }
 * ```
 * 
 * @see {@link Bun.file} - Bun's file API used for stat operations
 * @see {@link createDirectory} - For creating directories that don't exist
 */
export async function directoryExists(input: IDirectoryExistsInput) {
  const { path } = input;
  try {
    const stats = await Bun.file(path).stat();
    return stats.isDirectory();
  } catch {
    return false;
  }
}
