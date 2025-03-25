/**
 * Replaces the value of a specified key in an HCL file with a new value.
 * The function finds the key using regex and replaces only its value.
 * Supports top-level keys, keys within blocks, and nested keys using dot notation (e.g., "inputs.cluster_name").
 *
 * @param filePath - Path to the HCL file
 * @param key - The HCL key whose value needs to be replaced (can use dot notation for nested keys)
 * @param newValue - The new value to set
 * @returns Promise that resolves when the file has been updated
 */
export async function replaceHclValue(
  filePath: string,
  key: string,
  newValue: string
): Promise<void> {
  const content = await Bun.file(filePath).text();
  let updatedContent = content;

  if (key.includes(".")) {
    // Handle keys within blocks (e.g., "inputs.cluster_name")
    const parts = key.split(".");
    const blockName = parts[0];
    const nestedKey = parts[parts.length - 1];

    // Create regex for finding the key within a specific block
    const blockRegex = new RegExp(
      `(${blockName}\\s*=\\s*{[\\s\\S]*?)(${nestedKey}\\s*=\\s*)(".+?"|\\d+|true|false|"")([\\s\\S]*?})`,
      "g"
    );

    updatedContent = content.replace(blockRegex, `$1$2"${newValue}"$4`);
  } else {
    // Handle top-level keys
    const regex = new RegExp(`(${key}\\s*=\\s*)(".+?"|\\d+|true|false)`, "g");
    updatedContent = content.replace(regex, `$1"${newValue}"`);
  }

  // Write the updated content back to the file
  await Bun.write(filePath, updatedContent);
}
