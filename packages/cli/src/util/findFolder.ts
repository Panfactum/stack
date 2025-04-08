import fs from "node:fs/promises";
import path from "node:path";
import { safeDirectoryExists } from "./safe-directory-exists";

export async function findFolder(
  dir: string,
  folderName: string
): Promise<string | null> {
  // Check if the current directory is the one we're looking for
  const targetPath = path.join(dir, folderName);
  if (await safeDirectoryExists(targetPath)) {
    return targetPath;
  }

  // List all entries in the current directory
  const entries = await fs.readdir(dir, { withFileTypes: true });

  // Process all subdirectories
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      const subDirPath = path.join(dir, entry.name);
      const result = await findFolder(subDirPath, folderName);
      if (result) {
        return result;
      }
    }
  }

  return null;
}
