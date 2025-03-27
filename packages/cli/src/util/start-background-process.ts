import pc from "picocolors";
import type { BaseContext } from "clipanion";

export function startBackgroundProcess({
  args,
  command,
  context,
}: {
  args: string[];
  command: string;
  context: BaseContext;
}) {
  try {
    const proc = Bun.spawn([command, ...args], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });

    return proc.pid;
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Error starting process: ${error.message}`
        : "Error starting process";
    context.stderr.write(`${pc.red(errorMessage)}\n`);
    throw new Error("Failed to start process");
  }
}
