// This file manages background processes spawned by the CLI
// It provides utilities to track, kill, and clean up background processes

import treeKill from "tree-kill";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Represents a background process being tracked by the CLI
 */
export interface IBackgroundProcess {
  /** Process ID */
  pid: number;
  /** Command that was executed */
  command: string;
  /** Optional description of what the process is doing */
  description?: string;
}


/**
 * Global array tracking all background processes spawned by the CLI
 */
export const BACKGROUND_PROCESSES: IBackgroundProcess[] = [];

/**
 * Adds a background process to the tracking list
 * 
 * @param process - Process information to track
 * 
 * @example
 * ```typescript
 * addBackgroundProcess({
 *   pid: 1234,
 *   command: 'terraform apply',
 *   description: 'Applying infrastructure changes'
 * });
 * ```
 */
export const addBackgroundProcess = (process: IBackgroundProcess) => {
  BACKGROUND_PROCESSES.push(process);
};

/**
 * Removes a background process from the tracking list
 * 
 * @param pid - Process ID to remove
 * 
 * @internal
 */
export const removeBackgroundProcess = (pid: number) => {
  const index = BACKGROUND_PROCESSES.findIndex(p => p.pid === pid);
  if (index !== -1) {
    BACKGROUND_PROCESSES.splice(index, 1);
  }
};

/**
 * Input parameters for killBackgroundProcess
 */
interface IKillBackgroundProcessInput {
  /** Process ID to kill */
  pid: number;
  /** Panfactum context for logging */
  context: PanfactumContext;
  /** Time to wait for graceful shutdown before force kill (default: 5000ms) */
  gracefulTimeoutMs?: number;
  /** Whether to kill child processes as well (default: true) */
  killChildren?: boolean;
}

/**
 * Kills a background process with graceful shutdown and force kill fallback
 * 
 * @remarks
 * This function attempts to gracefully terminate a process with SIGTERM,
 * then force kills with SIGKILL if the process doesn't exit within the timeout.
 * It can optionally kill the entire process tree including child processes.
 * 
 * @param input - Parameters for killing the process
 * 
 * @example
 * ```typescript
 * killBackgroundProcess({
 *   pid: 1234,
 *   context,
 *   gracefulTimeoutMs: 10000,
 *   killChildren: true
 * });
 * ```
 */
export const killBackgroundProcess = (input: IKillBackgroundProcessInput) => {
  const { pid, context, gracefulTimeoutMs = 5000, killChildren = true } = input;
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

/**
 * Input parameters for killAllBackgroundProcesses
 */
interface IKillAllBackgroundProcessesInput {
  /** Panfactum context for logging */
  context: PanfactumContext;
}

/**
 * Kills all tracked background processes
 * 
 * @remarks
 * This function is typically called during CLI shutdown to ensure
 * all spawned background processes are properly terminated.
 * 
 * @param input - Parameters including context for logging
 * 
 * @example
 * ```typescript
 * // In cleanup handler
 * process.on('exit', () => {
 *   killAllBackgroundProcesses({ context });
 * });
 * ```
 */
export const killAllBackgroundProcesses = (input: IKillAllBackgroundProcessesInput) => {
  const { context } = input;
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

