import type { PanfactumContext } from "@/context/context";

export const BACKGROUND_PROCESS_PIDS: number[] = [];

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
