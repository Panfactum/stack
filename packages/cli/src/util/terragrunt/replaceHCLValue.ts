import { CLIError } from "@/util/error/error";

/**
 * Replaces the value of a specified key in an HCL file with a new value.
 * The function finds the key using regex and replaces only its value.
 * Supports top-level keys, keys within blocks, and nested keys using dot notation (e.g., "inputs.cluster_name").
 *
 * @param filePath - Path to the HCL file
 * @param key - The HCL key whose value needs to be replaced (can use dot notation for nested keys)
 * @param newValue - The new value to set (can be a string, boolean, number, or array)
 * @returns Promise that resolves when the file has been updated
 */
export async function replaceHCLValue(
  filePath: string,
  key: string,
  newValue: string | boolean | number | string[] | number[] | boolean[]
) {
  const content = await Bun.file(filePath).text();
  let updatedContent = content;

  // Format the new value based on its type
  let formattedValue: string;
  if (Array.isArray(newValue)) {
    // If the value is already formatted as a string with array syntax, use it directly
    if (
      typeof newValue[0] === "string" &&
      newValue.length === 1 &&
      newValue[0].startsWith("[") &&
      newValue[0].endsWith("]")
    ) {
      formattedValue = newValue[0];
    } else {
      // Otherwise format the array properly
      formattedValue = JSON.stringify(newValue)
        .replace(/"/g, '\"') // Ensure proper string escaping for HCL
        .replace(/,/g, ", "); // Add spaces after commas for better readability
    }
  } else if (typeof newValue === "boolean" || typeof newValue === "number") {
    formattedValue = String(newValue);
  } else {
    formattedValue = `"${newValue}"`;
  }

  if (key.includes(".")) {
    // Handle keys within blocks (e.g., "inputs.cluster_name")
    const parts = key.split(".");
    const blockName = parts[0];
    const nestedKey = parts[parts.length - 1];

    // Create regex for finding the key within a specific block
    const blockRegex = new RegExp(
      `(${blockName}\\s*=\\s*{[\\s\\S]*?)(${nestedKey}\\s*=\\s*)(".+?"|\\d+|true|false|""|\\[.*?\\])([\\s\\S]*?})`,
      "g"
    );

    updatedContent = content.replace(blockRegex, `$1$2${formattedValue}$4`);
  } else {
    // Handle top-level keys
    const regex = new RegExp(
      `(${key}\\s*=\\s*)(".+?"|\\d+|true|false|\\[.*?\\])`,
      "g"
    );
    updatedContent = content.replace(regex, `$1${formattedValue}`);
  }

  // Write the updated content back to the file
  try {
    await Bun.write(filePath, updatedContent);
  } catch(e){
    throw new CLIError(`Error writing ${key} to ${filePath}`, e)
  }

}
