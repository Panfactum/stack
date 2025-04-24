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

export const killAllBackgroundProcesses = ({
  context,
}: {
  context: PanfactumContext;
}) => {
  if (BACKGROUND_PROCESS_PIDS.length === 0) {
    context.logger.log("No background processes to kill", {
      level: "debug",
    });
    return;
  }

  context.logger.log(
    `Killing ${BACKGROUND_PROCESS_PIDS.length} background processes`,
    {
      level: "debug",
    }
  );

  for (const pid of [...BACKGROUND_PROCESS_PIDS]) {
    killBackgroundProcess({ pid, context });
    // Remove the pid from the array
    const index = BACKGROUND_PROCESS_PIDS.indexOf(pid);
    if (index !== -1) {
      BACKGROUND_PROCESS_PIDS.splice(index, 1);
    }
  }
};
