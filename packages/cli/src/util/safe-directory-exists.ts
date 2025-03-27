// A TypeScript version of the -d $PATH shell command
/**
 * Asynchronously checks if a directory exists at the given path without throwing an error if it doesn't.
 * 
 * @param {string} path - The path to the directory to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the directory exists, false otherwise.
 */
export async function safeDirectoryExists(path: string) {
  try {
    const stats = await Bun.file(path).stat();
    return stats.isDirectory();
  } catch {
    return false;
  }
}
