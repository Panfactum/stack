import pc from "picocolors";
import type { BaseContext } from "clipanion";

export const backgroundProcessIds: number[] = [];

export function startBackgroundProcess({
  args,
  command,
  context,
  env,
}: {
  args: string[];
  command: string;
  context: BaseContext;
  env?: Record<string, string | undefined>;
}) {
  try {
    const proc = Bun.spawn([command, ...args], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      env,
    });

    backgroundProcessIds.push(proc.pid);
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
