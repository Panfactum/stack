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
      files.push(file);
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
    const filePath = path.join(absolutePath, file);
    const content = await readFile(filePath);
    const hash = createHash('sha1').update(content).digest('hex');
    hashes.push(`${hash}  ${file}`);
  }

  // Calculate final hash
  const combinedContent = hashes.join('\n');
  return createHash('sha1').update(combinedContent).digest('hex');
}