import { CLISubprocessError } from "../error/error";
import type { PanfactumContext } from "../../context/context";

export const BACKGROUND_PROCESS_PIDS: number[] = [];

export function startBackgroundProcess({
  args,
  command,
  env,
}: {
  args: string[];
  command: string;
  env?: Record<string, string | undefined>;
}) {
  try {
    const proc = Bun.spawn([command, ...args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env,
    });

    BACKGROUND_PROCESS_PIDS.push(proc.pid);
    return proc.pid;
  } catch (error) {
    throw new CLISubprocessError(`Failed to start process`, {
      command: [command, ...args].join(" "),
      subprocessLogs: error instanceof Error ? error.message : "Unknown error",
      workingDirectory: process.cwd(),
    });
  }
}

export const killBackgroundProcess = ({
  pid,
  context,
}: {
  pid: number;
  context: PanfactumContext;
}) => {
  try {
    process.kill(pid);
  } catch {
    context.logger.log(`Failed to kill background process with pid: ${pid}`, {
      level: "debug",
      style: "warning",
    });
  }
};
