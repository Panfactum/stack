import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { Glob } from 'bun';

/**
 * Generates a SHA1 hash of a Terraform module's contents for cache invalidation
 * @param modulePath - Path to the module directory
 * @returns SHA1 hash of the module contents, or empty string if no files found
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