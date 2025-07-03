// This file provides cross-platform process tree termination functionality
// It recursively discovers and kills a process and all its child processes

import { CLISubprocessError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for killProcessTree function
 */
export interface IKillProcessTreeInput {
  /** Process ID to kill along with its children */
  pid: number;
  /** Signal to send (SIGTERM or SIGKILL) */
  signal?: 'SIGTERM' | 'SIGKILL';
  /** Panfactum context for logging */
  context: PanfactumContext;
  /** Timeout before force killing (milliseconds) - not used in this implementation but kept for API compatibility */
  timeout?: number;
}

/**
 * Kills a process and all its child processes
 * 
 * @remarks
 * This function discovers and terminates an entire process tree across
 * Windows, macOS, and Linux platforms. It first attempts graceful termination
 * with the specified signal, then force kills if needed. Errors for non-existent
 * processes (ESRCH) are silently ignored.
 * 
 * @param input - Parameters for killing the process tree
 * @returns Promise that resolves when the process tree is terminated
 * 
 * @example
 * ```typescript
 * await killProcessTree({
 *   pid: 1234,
 *   signal: 'SIGTERM',
 *   context
 * });
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when the process tree cannot be killed due to permissions or other errors
 */
export async function killProcessTree(input: IKillProcessTreeInput): Promise<void> {
  const { pid, signal = 'SIGTERM', context } = input;

  // Validate PID
  if (!Number.isInteger(pid) || pid < 0) {
    throw new CLISubprocessError('Invalid process ID', {
      command: 'killProcessTree',
      subprocessLogs: `PID must be a positive integer, got: ${pid}`,
      workingDirectory: process.cwd()
    });
  }

  // Safety check: prevent killing critical system processes
  const criticalPids = [0, 1, 2]; // PID 0 (kernel), PID 1 (init), PID 2 (kernel threads)
  if (criticalPids.includes(pid)) {
    context.logger.debug(`Refusing to kill critical system process with PID ${pid}`);
    return;
  }

  context.logger.debug(`Killing process tree for PID ${pid} with signal ${signal}`);

  // Platform-specific implementation
  const platform = process.platform;
  
  try {
    if (platform === 'win32') {
      await killWindowsProcessTree(pid, context);
    } else {
      // For Unix-like systems (Linux and macOS)
      const allPids = await buildUnixProcessTree(pid, context);
      await killUnixProcesses(allPids, signal, context);
    }
  } catch (error) {
    // Only throw if it's not a "process not found" error
    if (error instanceof CLISubprocessError && !error.message.includes('ESRCH')) {
      throw error;
    }
    // Silently ignore ESRCH errors
    context.logger.debug(`Process ${pid} not found or already terminated`);
  }
}

/**
 * Kills a process tree on Windows using taskkill
 * 
 * @internal
 * @param pid - Root process ID
 * @param context - Panfactum context for logging
 */
async function killWindowsProcessTree(pid: number, context: PanfactumContext): Promise<void> {
  try {
    const proc = Bun.spawn(['taskkill', '/pid', pid.toString(), '/T', '/F'], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    
    const exitCode = await proc.exited;
    
    // taskkill returns exit code 128 if process not found
    if (exitCode !== 0 && exitCode !== 128) {
      const stderr = await new globalThis.Response(proc.stderr).text();
      throw new CLISubprocessError(`Failed to kill process tree on Windows`, {
        command: 'taskkill',
        subprocessLogs: stderr,
        workingDirectory: process.cwd()
      });
    }
    
    if (exitCode === 128) {
      context.logger.debug(`Process ${pid} not found on Windows`);
    }
  } catch (error) {
    if (error instanceof CLISubprocessError) {
      throw error;
    }
    // Handle spawn errors
    throw new CLISubprocessError(`Failed to spawn taskkill`, {
      command: 'taskkill',
      subprocessLogs: error instanceof Error ? error.message : String(error),
      workingDirectory: process.cwd()
    });
  }
}

/**
 * Builds a complete process tree on Unix-like systems
 * 
 * @internal
 * @param rootPid - Root process ID
 * @param context - Panfactum context for logging
 * @returns Set of all PIDs in the process tree
 */
async function buildUnixProcessTree(rootPid: number, context: PanfactumContext): Promise<Set<number>> {
  const allPids = new Set<number>();
  const pidsToProcess = [rootPid];
  const criticalPids = [0, 1, 2]; // PID 0 (kernel), PID 1 (init), PID 2 (kernel threads)
  
  // Safety check: don't build trees from critical processes
  if (criticalPids.includes(rootPid)) {
    context.logger.debug(`Refusing to build process tree from critical system process with PID ${rootPid}`);
    return allPids;
  }
  
  while (pidsToProcess.length > 0) {
    const pid = pidsToProcess.pop()!;
    
    // Skip if we've already processed this PID
    if (allPids.has(pid)) {
      continue;
    }
    
    // Skip critical PIDs if they somehow appear in the tree
    if (criticalPids.includes(pid)) {
      context.logger.debug(`Skipping critical system process with PID ${pid} in process tree`);
      continue;
    }
    
    allPids.add(pid);
    
    // Get child PIDs
    const childPids = await getUnixChildPids(pid, context);
    pidsToProcess.push(...childPids);
  }
  
  return allPids;
}

/**
 * Gets child PIDs on Unix-like systems
 * 
 * @internal
 * @param pid - Parent process ID
 * @param context - Panfactum context for logging
 * @returns Array of child PIDs
 */
async function getUnixChildPids(pid: number, context: PanfactumContext): Promise<number[]> {
  const platform = process.platform;
  let command: string[];
  
  if (platform === 'darwin') {
    // macOS uses pgrep
    command = ['pgrep', '-P', pid.toString()];
  } else {
    // Linux uses ps
    command = ['ps', '-o', 'pid', '--no-headers', '--ppid', pid.toString()];
  }
  
  try {
    const proc = Bun.spawn(command, {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    
    const exitCode = await proc.exited;
    
    // Exit code 1 means no processes found
    if (exitCode === 1) {
      return [];
    }
    
    const stdout = await new globalThis.Response(proc.stdout).text();
    
    if (exitCode !== 0) {
      const stderr = await new globalThis.Response(proc.stderr).text();
      context.logger.debug(`Failed to get child PIDs for ${pid}: exit code ${exitCode}, stderr: ${stderr}`);
      return [];
    }
    
    if (!stdout) {
      return [];
    }
    
    // Parse PIDs from output
    return stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => parseInt(line, 10))
      .filter(pid => !isNaN(pid));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.debug(`Failed to get child PIDs for ${pid}: ${errorMessage}`);
    return [];
  }
}

/**
 * Kills processes on Unix-like systems
 * 
 * @internal
 * @param pids - Set of PIDs to kill
 * @param signal - Signal to send
 * @param context - Panfactum context for logging
 */
async function killUnixProcesses(pids: Set<number>, signal: string, context: PanfactumContext): Promise<void> {
  // Convert signal name to number
  const signalNum = signal === 'SIGKILL' ? '9' : '15';
  
  // Kill processes starting from children (reverse order)
  const pidArray = Array.from(pids).reverse();
  
  for (const pid of pidArray) {
    try {
      if (signalNum === '9') {
        process.kill(pid, 'SIGKILL');
      } else {
        process.kill(pid, 'SIGTERM');
      }
      context.logger.debug(`Sent ${signal} to process ${pid}`);
    } catch (error) {
      // Ignore ESRCH errors (process not found)
      if (error instanceof Error && 'code' in error && error.code !== 'ESRCH') {
        context.logger.debug(`Failed to kill process ${pid}: ${error.message}`);
      }
    }
  }
}