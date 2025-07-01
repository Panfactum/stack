// This file provides utilities for computing content hashes of Terraform modules
// It's used to detect when module contents have changed and need redeployment

import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { Glob } from 'bun';

/**
 * Generates a SHA1 hash of a Terraform module's contents for cache invalidation
 * 
 * @remarks
 * This function computes a deterministic hash of all non-hidden files in a
 * Terraform/Terragrunt module directory. The hash is used to:
 * - Detect when module contents have changed
 * - Invalidate caches when updates occur
 * - Track module versions for deployment
 * - Ensure consistency across deployments
 * 
 * The hashing algorithm:
 * 1. Finds all non-hidden files in the module directory
 * 2. Sorts files for consistent ordering
 * 3. Computes SHA1 hash of each file's contents
 * 4. Combines individual hashes with filenames
 * 5. Computes final SHA1 hash of the combined data
 * 
 * This approach ensures:
 * - Deterministic results across different systems
 * - Detection of any file content changes
 * - Compatibility with standard sha1sum tools
 * - Efficient change detection without full content comparison
 * 
 * @param modulePath - Path to the module directory
 * @returns SHA1 hash of the module contents, or empty string if no files found
 * 
 * @example
 * ```typescript
 * const moduleHash = await getModuleHash('/environments/prod/us-east-1/aws_vpc');
 * console.log(`Module hash: ${moduleHash}`);
 * // Output: "a1b2c3d4e5f6789012345678901234567890abcd"
 * 
 * // Check if module has changed
 * const oldHash = await getStoredHash();
 * if (moduleHash !== oldHash) {
 *   console.log('Module contents have changed, redeployment needed');
 * }
 * ```
 * 
 * @see {@link getModuleStatus} - Uses this hash to track module changes
 * @see {@link updateModuleStatus} - Stores this hash after deployment
 */
export async function getModuleHash(modulePath: string): Promise<string> {
  if (!modulePath) {
    return '';
  }

  const absolutePath = path.resolve(modulePath);
  
  // Find all files (excluding hidden files)
  const glob = new Glob('**/*');
  const files: string[] = [];
  
  for await (const file of glob.scan({
    cwd: absolutePath,
    onlyFiles: true,
    followSymlinks: false
  })) {
    // Skip hidden files
    if (!file.startsWith('.') && !file.includes('/.')) {
      // Use absolute path to match bash behavior with realpath
      files.push(path.join(absolutePath, file));
    }
  }

  if (files.length === 0) {
    return '';
  }

  // Sort files for consistent ordering
  files.sort();

  // Calculate hash for each file
  const hashes: string[] = [];
  for (const file of files) {
    // File is already an absolute path
    const content = await readFile(file);
    const hash = createHash('sha1').update(content).digest('hex');
    hashes.push(`${hash}  ${file}`);
  }

  // Calculate final hash
  // Add trailing newline to match bash sha1sum output format
  const combinedContent = hashes.join('\n') + '\n';
  return createHash('sha1').update(combinedContent).digest('hex');
}