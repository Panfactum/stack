// This file provides a class-based manager for background processes spawned by the CLI
// It encapsulates process tracking, killing, and cleanup functionality

import { killProcessTree } from "@/util/subprocess/killProcessTree";
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
 * Input parameters for killing a background process
 */
interface IKillBackgroundProcessInput {
  /** Process ID to kill */
  pid: number;
  /** Time to wait for graceful shutdown before force kill (default: 5000ms) */
  gracefulTimeoutMs?: number;
  /** Whether to kill child processes as well (default: true) */
  killChildren?: boolean;
}

/**
 * Manager class for tracking and controlling background processes spawned by the CLI
 * 
 * @remarks
 * This class encapsulates all background process management functionality including:
 * - Process tracking and registration
 * - Graceful and force termination
 * - Cleanup of process trees
 * - Bulk operations on all tracked processes
 * 
 * The manager is designed to be attached to the PanfactumContext for easy access
 * throughout the CLI lifecycle.
 * 
 * @example
 * ```typescript
 * const manager = new BackgroundProcessManager(context);
 * 
 * // Add a process to tracking
 * manager.addProcess({
 *   pid: 1234,
 *   command: 'terraform apply',
 *   description: 'Applying infrastructure changes'
 * });
 * 
 * // Kill a specific process
 * await manager.killProcess({ pid: 1234 });
 * 
 * // Kill all tracked processes (typically during cleanup)
 * await manager.killAllProcesses();
 * ```
 */
export class BackgroundProcessManager {
  /**
   * Array of currently tracked background processes
   */
  private readonly processes: IBackgroundProcess[] = [];

  /**
   * Creates a new BackgroundProcessManager instance
   * 
   * @param context - Panfactum context for logging and configuration
   */
  constructor(private readonly context: PanfactumContext) {}

  /**
   * Adds a background process to the tracking list
   * 
   * @param process - Process information to track
   * 
   * @example
   * ```typescript
   * manager.addProcess({
   *   pid: 1234,
   *   command: 'terraform apply',
   *   description: 'Applying infrastructure changes'
   * });
   * ```
   */
  public addProcess(process: IBackgroundProcess): void {
    this.processes.push(process);
    this.context.logger.debug(`Added background process to tracking: PID ${process.pid} - ${process.command}`);
  }

  /**
   * Removes a background process from the tracking list
   * 
   * @param pid - Process ID to remove
   */
  public removeProcess(pid: number): void {
    const index = this.processes.findIndex(p => p.pid === pid);
    if (index !== -1) {
      const process = this.processes[index]!;
      this.processes.splice(index, 1);
      this.context.logger.debug(`Removed background process from tracking: PID ${pid} - ${process.command}`);
    }
  }

  /**
   * Gets a copy of all currently tracked processes
   * 
   * @returns Array of tracked background processes
   */
  public getProcesses(): readonly IBackgroundProcess[] {
    return [...this.processes];
  }

  /**
   * Gets the count of currently tracked processes
   * 
   * @returns Number of tracked processes
   */
  public getProcessCount(): number {
    return this.processes.length;
  }

  /**
   * Finds a tracked process by PID
   * 
   * @param pid - Process ID to find
   * @returns Process information if found, undefined otherwise
   */
  public findProcess(pid: number): IBackgroundProcess | undefined {
    return this.processes.find(p => p.pid === pid);
  }

  /**
   * Kills a background process with graceful shutdown and force kill fallback
   * 
   * @remarks
   * This function attempts to gracefully terminate a process with SIGTERM,
   * then force kills with SIGKILL if the process doesn't exit within the timeout.
   * It can optionally kill the entire process tree including child processes.
   * 
   * The function can be used synchronously (fire-and-forget) or asynchronously.
   * For cleanup handlers, the synchronous usage is sufficient.
   * 
   * @param input - Parameters for killing the process
   * 
   * @example
   * ```typescript
   * // Kill with default settings
   * await manager.killProcess({ pid: 1234 });
   * 
   * // Kill with custom timeout and no children
   * await manager.killProcess({
   *   pid: 1234,
   *   gracefulTimeoutMs: 10000,
   *   killChildren: false
   * });
   * ```
   * 
   * @throws {@link Error}
   * May throw if process killing encounters unexpected errors
   */
  public killProcess(input: IKillBackgroundProcessInput): Promise<void> {
    const { pid, gracefulTimeoutMs = 5000, killChildren = true } = input;
    const proc = this.findProcess(pid);
    const processInfo = proc ? `${proc.command}${proc.description ? ` (${proc.description})` : ''}` : `PID ${pid}`;
    
    return (async () => {
      try {
        // First check if process exists
        try {
          process.kill(pid, 0); // Signal 0 checks if process exists
        } catch {
          // Process doesn't exist, remove from tracking immediately
          this.removeProcess(pid);
          return;
        }

        if (killChildren) {
          // Use killProcessTree to kill the entire process tree
          await killProcessTree({
            pid,
            signal: 'SIGTERM',
            context: this.context
          });
          this.context.logger.debug(`Sent SIGTERM to process tree ${processInfo}`);
        } else {
          // Kill only the main process
          process.kill(pid, 'SIGTERM');
          this.context.logger.debug(`Sent SIGTERM to process ${processInfo}`);
        }
        
        // Set up a timeout to force kill if needed
        const killTimeout = globalThis.setTimeout(async () => {
          try {
            if (killChildren) {
              // Force kill the entire process tree
              await killProcessTree({
                pid,
                signal: 'SIGKILL',
                context: this.context
              });
              this.context.logger.debug(`Sent SIGKILL to process tree ${processInfo} after timeout`);
            } else {
              // Force kill only the main process
              process.kill(pid, 'SIGKILL');
              this.context.logger.debug(`Sent SIGKILL to process ${processInfo} after timeout`);
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
            this.removeProcess(pid);
          }
        }, 100);
        
        // Clean up after max timeout
        globalThis.setTimeout(() => {
          globalThis.clearInterval(checkInterval);
          globalThis.clearTimeout(killTimeout);
          this.removeProcess(pid);
        }, gracefulTimeoutMs + 1000);
        
      } catch (error) {
        // Process might already be dead
        const isProcessNotFound = error instanceof Error && error.message.includes('ESRCH');
        if (!isProcessNotFound) {
          this.context.logger.debug(`Failed to kill background process ${processInfo}:`, { error });
        }
        // Remove from tracking immediately if kill failed (process might be already dead)
        this.removeProcess(pid);
      }
    })();
  }

  /**
   * Kills all tracked background processes
   * 
   * @remarks
   * This function is typically called during CLI shutdown to ensure
   * all spawned background processes are properly terminated.
   * 
   * @example
   * ```typescript
   * // In cleanup handler
   * process.on('exit', async () => {
   *   await manager.killAllProcesses();
   * });
   * ```
   */
  public async killAllProcesses(): Promise<void> {
    if (this.processes.length === 0) {
      this.context.logger.debug("No background processes to kill");
      return;
    }

    this.context.logger.debug(`Killing ${this.processes.length} background processes:`);
    
    // Log details about each process being killed
    for (const proc of this.processes) {
      this.context.logger.debug(`  - PID ${proc.pid}: ${proc.command}${proc.description ? ` (${proc.description})` : ''}`);
    }

    // Kill all processes in parallel
    const killPromises = [...this.processes].map(proc => 
      this.killProcess({ pid: proc.pid })
    );
    
    await Promise.allSettled(killPromises);
  }

  /**
   * Clears all tracked processes without killing them
   * 
   * @remarks
   * This is useful for testing or when processes are known to have exited
   * through other means. Use with caution in production code.
   * 
   * @internal
   */
  public clearProcesses(): void {
    this.processes.length = 0;
    this.context.logger.debug("Cleared all tracked background processes");
  }
}