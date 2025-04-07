import path from "node:path";
import pc from "picocolors";
import type { BaseContext } from "clipanion";

export async function writeErrorToDebugFile({
  context,
  error,
}: {
  context: BaseContext;
  error: unknown;
}) {
  const currentDirectory = process.cwd();
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const debugFilePath = path.join(currentDirectory, `${timestamp}-error.log`);

  try {
    await Bun.write(debugFilePath, `${JSON.stringify(error, null, 2)}`);
  } catch (error) {
    context.stderr.write(
      pc.red(
        `Failed to write error to debug file: ${JSON.stringify(error, null, 2)}`
      )
    );
  }
}
