import { appendFile } from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { safeFileExists } from "./safe-file-exists";
import type { BaseContext } from "clipanion";

export async function writeErrorToDebugFile({
  context,
  error,
}: {
  context: BaseContext;
  error: unknown;
}) {
  const currentDirectory = process.cwd();
  const debugFilePath = path.join(currentDirectory, "error.log");
  const debugFileExists = await safeFileExists(debugFilePath);
  const timestamp = new Date().toISOString();

  try {
    if (!debugFileExists) {
      await Bun.write(debugFilePath, `${timestamp}\n${JSON.stringify(error, null, 2)}`);
    } else {
      await appendFile(debugFilePath, `${timestamp}\n${JSON.stringify(error, null, 2)}`);
    }
  } catch (error) {
    context.stderr.write(pc.red(`Failed to write error to debug file: ${JSON.stringify(error, null, 2)}`));
  }
}
