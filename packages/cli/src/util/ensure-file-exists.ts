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
    // File doesn't exist, write it
    verbose && context.stdout.write(`Writing ${destinationFile}`);

    // Make sure the directory exists
    await mkdir(dirname(destinationFile), { recursive: true });

    await Bun.write(destinationFile, sourceFile);
    verbose && context.stdout.write(`Wrote ${destinationFile} successfully`);
  }
}
