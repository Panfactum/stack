import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { downloadFile } from "./download-file";
import type { BaseContext } from "clipanion";

export async function ensureFileExists({
  context,
  downloadUrl,
  filePath,
  verbose = false,
}: {
  context: BaseContext;
  downloadUrl: string;
  filePath: string;
  verbose?: boolean;
}): Promise<void> {
  // Only take action if the file doesn't already exist.
  if (!(await Bun.file(filePath).exists())) {
    // File doesn't exist, download it
    verbose &&
      context.stdout.write(`Downloading ${filePath} from ${downloadUrl}`);

    // Make sure the directory exists
    await mkdir(dirname(filePath), { recursive: true });

    await downloadFile(downloadUrl, filePath);
    verbose && context.stdout.write(`Downloaded ${filePath} successfully`);
  }
}
