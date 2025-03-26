// In some places we need to check if a file exists,
// but we don't want to throw an error if it doesn't.
// This replicates the behavior of shell scripts with this code:
// if [[ -f $FILE ]]; then
//   ...
// fi
// This is useful for cases where we want to check if a file exists
// but don't want to throw an error if it doesn't.
// For example, we want to delete a file if it exists, but don't want to throw an error if it doesn't.

/**
 * Asynchronously checks if a file exists at the given path without throwing an error if it doesn't.
 *
 * @param {string} filePath - The path to the file to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the file exists, false otherwise.
 */
export const safeFileExists = async (filePath: string) => {
  try {
    return await Bun.file(filePath).exists();
  } catch {
    return false;
  }
};
