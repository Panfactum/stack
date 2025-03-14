export async function replaceHclValue(
  filePath: string,
  key: string,
  newValue: string
): Promise<void> {
  const content = await Bun.file(filePath).text();

  // Create regex for finding the key-value pair
  const regex = new RegExp(`(${key}\\s*=\\s*)(".+?"|\\d+|true|false)`, "g");

  // Replace the value
  const updatedContent = content.replace(regex, `$1"${newValue}"`);

  // Write the updated content back to the file
  await Bun.write(filePath, updatedContent);
}
