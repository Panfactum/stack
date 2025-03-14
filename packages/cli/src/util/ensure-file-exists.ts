import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { BaseContext } from "clipanion";

export async function ensureFileExists({
  context,
  destinationFile,
  sourceFile,
  verbose = false,
}: {
  context: BaseContext;
  destinationFile: string;
  sourceFile: string;
  verbose?: boolean;
}): Promise<void> {
  // Only take action if the file doesn't already exist.
  if (!(await Bun.file(destinationFile).exists())) {
    // File doesn't exist, download it
    verbose && context.stdout.write(`Writing ${destinationFile}`);

    // Make sure the directory exists
    await mkdir(dirname(destinationFile), { recursive: true });

    await Bun.write(destinationFile, Bun.file(sourceFile));
    verbose &&
      context.stdout.write(`Downloaded ${destinationFile} successfully`);
  }
}
