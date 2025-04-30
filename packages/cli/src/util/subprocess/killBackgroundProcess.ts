import type { PanfactumContext } from "@/util/context/context";

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
    context.logger.debug(`Failed to kill background process`, { pid })
  }
};

export const killAllBackgroundProcesses = ({
  context,
}: {
  context: PanfactumContext;
}) => {
  if (BACKGROUND_PROCESS_PIDS.length === 0) {
    context.logger.debug("No background processes to kill")
    return;
  }

  // TODO: @seth - Better logging: what are the background processes?
  context.logger.debug("Killing ${BACKGROUND_PROCESS_PIDS.length} background processes");

  for (const pid of [...BACKGROUND_PROCESS_PIDS]) {
    killBackgroundProcess({ pid, context });
    // Remove the pid from the array
    const index = BACKGROUND_PROCESS_PIDS.indexOf(pid);
    if (index !== -1) {
      BACKGROUND_PROCESS_PIDS.splice(index, 1);
    }
  }
};
