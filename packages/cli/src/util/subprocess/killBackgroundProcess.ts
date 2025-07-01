import type { PanfactumContext } from "@/util/context/context";
const treeKill = require("tree-kill") as (pid: number, signal?: string | number, callback?: (error?: Error) => void) => void;

export interface BackgroundProcess {
  pid: number;
  command: string;
  description?: string;
}

export const BACKGROUND_PROCESSES: BackgroundProcess[] = [];

export const addBackgroundProcess = (process: BackgroundProcess) => {
  BACKGROUND_PROCESSES.push(process);
};

export const removeBackgroundProcess = (pid: number) => {
  const index = BACKGROUND_PROCESSES.findIndex(p => p.pid === pid);
  if (index !== -1) {
    BACKGROUND_PROCESSES.splice(index, 1);
  }
};

export const killBackgroundProcess = ({
  pid,
  context,
  gracefulTimeoutMs = 5000,
  killChildren = true,
}: {
  pid: number;
  context: PanfactumContext;
  gracefulTimeoutMs?: number;
  killChildren?: boolean;
}) => {
  const proc = BACKGROUND_PROCESSES.find(p => p.pid === pid);
  const processInfo = proc ? `${proc.command}${proc.description ? ` (${proc.description})` : ''}` : `PID ${pid}`;
  
  try {
    if (killChildren) {
      // Use tree-kill to kill the entire process tree
      treeKill(pid, 'SIGTERM', (err) => {
        if (err && !err.message.includes('ESRCH')) {
          context.logger.debug(`Failed to kill process tree for ${processInfo}:`, { error: err });
        } else {
          context.logger.debug(`Sent SIGTERM to process tree ${processInfo}`);
        }
      });
    } else {
      // Kill only the main process
      process.kill(pid, 'SIGTERM');
      context.logger.debug(`Sent SIGTERM to process ${processInfo}`);
    }
    
    // Set up a timeout to force kill if needed
    const killTimeout = globalThis.setTimeout(() => {
      try {
        if (killChildren) {
          // Force kill the entire process tree
          treeKill(pid, 'SIGKILL', (err) => {
            if (err && !err.message.includes('ESRCH')) {
              context.logger.debug(`Failed to force kill process tree for ${processInfo}:`, { error: err });
            } else {
              context.logger.debug(`Sent SIGKILL to process tree ${processInfo} after timeout`);
            }
          });
        } else {
          // Force kill only the main process
          process.kill(pid, 'SIGKILL');
          context.logger.debug(`Sent SIGKILL to process ${processInfo} after timeout`);
        }
      } catch {
        // Process might have already exited
      }
    }, gracefulTimeoutMs);
    
    // Check if process exists by sending signal 0
    const checkInterval = globalThis.setInterval(() => {
      try {
        process.kill(pid, 0); // Signal 0 checks if process exists
      } catch {
        // Process has exited
        globalThis.clearInterval(checkInterval);
        globalThis.clearTimeout(killTimeout);
        removeBackgroundProcess(pid);
      }
    }, 100);
    
    // Clean up after max timeout
    globalThis.setTimeout(() => {
      globalThis.clearInterval(checkInterval);
      globalThis.clearTimeout(killTimeout);
      removeBackgroundProcess(pid);
    }, gracefulTimeoutMs + 1000);
    
  } catch (error) {
    // Process might already be dead
    const isProcessNotFound = error instanceof Error && error.message.includes('ESRCH');
    if (!isProcessNotFound) {
      context.logger.debug(`Failed to kill background process ${processInfo}:`, { error });
    }
    // Remove from tracking even if kill failed (process might be already dead)
    removeBackgroundProcess(pid);
  }
};

export const killAllBackgroundProcesses = ({
  context,
}: {
  context: PanfactumContext;
}) => {
  if (BACKGROUND_PROCESSES.length === 0) {
    context.logger.debug("No background processes to kill");
    return;
  }

  context.logger.debug(`Killing ${BACKGROUND_PROCESSES.length} background processes:`);
  
  // Log details about each process being killed
  for (const proc of BACKGROUND_PROCESSES) {
    context.logger.debug(`  - PID ${proc.pid}: ${proc.command}${proc.description ? ` (${proc.description})` : ''}`);
  }

  // Kill all processes
  for (const proc of [...BACKGROUND_PROCESSES]) {
    killBackgroundProcess({ pid: proc.pid, context });
  }
};

