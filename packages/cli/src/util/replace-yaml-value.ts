import { parse, stringify } from "yaml";

/**
 * Replaces a value for a specific key in a YAML file
 * @param filePath - Path to the YAML file
 * @param key - The key whose value should be replaced (can be nested using dot notation, e.g., 'parent.child')
 * @param newValue - The new value to set
 * @returns Promise that resolves when the operation is complete
 */
export async function replaceYamlValue(
  filePath: string,
  key: string,
  newValue: string | number | boolean
): Promise<void> {
  // Read the YAML file
  const content = await Bun.file(filePath).text();

  // Parse the YAML content
  const data = parse(content) as Record<string, unknown>;

  // Check if this is a nested key (using dot notation)
  const keyParts = key.split(".");

  if (keyParts.length === 1) {
    // Simple case: top-level key
    data[key] = newValue;
  } else if (keyParts.length === 2) {
    // Nested case (maximum 2 levels deep)
    const [parentKey, childKey] = keyParts;

    // Validate that we have non-empty string keys
    if (
      parentKey === "" ||
      childKey === "" ||
      parentKey === undefined ||
      childKey === undefined
    ) {
      throw new Error("Invalid key format. Keys cannot be empty strings.");
    }

    // Ensure the parent object exists
    if (
      data[parentKey] === undefined ||
      data[parentKey] === null ||
      typeof data[parentKey] !== "object"
    ) {
      data[parentKey] = {};
    }

    // Cast to the appropriate type and update the nested value
    const parentObj = data[parentKey] as Record<string, unknown>;
    parentObj[childKey] = newValue;
  } else {
    throw new Error(
      "Keys with more than 2 levels of nesting are not supported"
    );
  }

  // Convert back to YAML
  const updatedContent = stringify(data, {
    doubleQuotedAsJSON: true,
  });

  // Write the updated content back to the file
  await Bun.write(filePath, updatedContent);
}
