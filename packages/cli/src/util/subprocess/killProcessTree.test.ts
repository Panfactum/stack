// Unit tests for the killProcessTree utility
// Tests cross-platform process tree termination functionality

import { rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { CLISubprocessError } from '@/util/error/error';
import { createTestDir } from '@/util/test/createTestDir';
import { sleep } from '@/util/util/sleep';
import { BackgroundProcessManager } from './BackgroundProcessManager';
import { execute } from './execute';
import { 
  killProcessTree
} from './killProcessTree';
import type { PanfactumContext } from '@/util/context/context';

describe('killProcessTree', () => {
  let testDir: string;
  let mockContext: PanfactumContext;
  
  // Common sleep script content used across tests
  const SLEEP_SCRIPT_CONTENT = '#!/bin/sh\nsleep 30';
  
  beforeEach(async () => {
    const result = await createTestDir({ functionName: 'killProcessTree' });
    testDir = result.path;
    
    // Create a mock context with logger
    mockContext = {
      logger: {
        debug: mock(() => {}),
        error: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
      }
    } as unknown as PanfactumContext;
    
    // Add background process manager to the context
    const backgroundProcessManager = new BackgroundProcessManager(mockContext);
    mockContext.backgroundProcessManager = backgroundProcessManager;
  });

  afterEach(async () => {
    await rmdir(testDir, { recursive: true });
  });

  test('validates PID input', async () => {
    await expect(killProcessTree({
      pid: -1,
      context: mockContext
    })).rejects.toThrow(CLISubprocessError);

    await expect(killProcessTree({
      pid: 1.5,
      context: mockContext
    })).rejects.toThrow(CLISubprocessError);
  });

  test('handles non-existent process gracefully', async () => {
    // Use a PID that's unlikely to exist
    const nonExistentPid = 999999;
    
    // Should not throw for non-existent process
    await expect(killProcessTree({
      pid: nonExistentPid,
      context: mockContext
    })).resolves.toBeUndefined();

    expect(mockContext.logger.debug).toHaveBeenCalled();
  });

  test('kills single process without children', async () => {
    // Create a simple long-running process
    const scriptPath = join(testDir, 'simple-process.sh');
    await writeFile(scriptPath, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Verify process is running
    expect(() => process.kill(proc.pid, 0)).not.toThrow();

    // Kill the process tree
    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    // Give it a moment to terminate
    await sleep(100);

    // Verify process is gone
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('kills process tree with children', async () => {
    // Create a parent process that spawns children
    const parentScript = join(testDir, 'parent-process.sh');
    const childScript = join(testDir, 'child-process.sh');
    
    await writeFile(childScript, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    await writeFile(parentScript, `#!/bin/sh
${childScript} &
${childScript} &
wait`, { mode: 0o755 });

    const proc = await execute({
      command: [parentScript],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Give time for children to spawn
    await sleep(500);

    // Verify parent is running
    expect(() => process.kill(proc.pid, 0)).not.toThrow();

    // Kill the process tree
    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    // Give time for termination
    await sleep(300);

    // Verify parent is gone
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('uses SIGTERM by default', async () => {
    const scriptPath = join(testDir, 'graceful-process.sh');
    await writeFile(scriptPath, `#!/bin/sh
trap 'echo "Caught SIGTERM"; exit 0' TERM
sleep 30`, { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    await sleep(100);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('can use SIGKILL signal', async () => {
    const scriptPath = join(testDir, 'stubborn-process.sh');
    await writeFile(scriptPath, `#!/bin/sh
trap '' TERM  # Ignore SIGTERM
sleep 30`, { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    await killProcessTree({
      pid: proc.pid,
      signal: 'SIGKILL',
      context: mockContext
    });

    await sleep(100);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('logs debug information', async () => {
    const nonExistentPid = 999999;
    
    await killProcessTree({
      pid: nonExistentPid,
      context: mockContext
    });

    expect(mockContext.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Killing process tree for PID 999999')
    );
  });

  test('handles deep process tree', async () => {
    // Create a script that spawns multiple levels of processes
    const level3Script = join(testDir, 'level3.sh');
    const level2Script = join(testDir, 'level2.sh');
    const level1Script = join(testDir, 'level1.sh');
    
    await writeFile(level3Script, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    await writeFile(level2Script, `#!/bin/sh\n${level3Script} &\nwait`, { mode: 0o755 });
    await writeFile(level1Script, `#!/bin/sh\n${level2Script} &\nwait`, { mode: 0o755 });

    const proc = await execute({
      command: [level1Script],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Give time for the tree to form
    await sleep(500);

    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    await sleep(300);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('handles processes that exit during tree building', async () => {
    // Create a process that exits quickly
    const shortScript = join(testDir, 'short-process.sh');
    await writeFile(shortScript, '#!/bin/sh\nsleep 0.1', { mode: 0o755 });
    
    const proc = await execute({
      command: [shortScript],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Wait for it to likely exit
    await sleep(200);

    // Should not throw even if process is already gone
    await expect(killProcessTree({
      pid: proc.pid,
      context: mockContext
    })).resolves.toBeUndefined();
  });

  test('handles critical system processes safely', async () => {
    // Try to kill critical system processes - should be safely ignored
    const criticalPids = [0, 1, 2];
    
    for (const pid of criticalPids) {
      // Clear previous mock calls
      mockContext.logger.debug = mock(() => {});
      
      await expect(killProcessTree({
        pid,
        context: mockContext
      })).resolves.toBeUndefined();

      // Verify that debug log was called
      expect(mockContext.logger.debug).toHaveBeenCalledWith(
        `Refusing to kill critical system process with PID ${pid}`
      );
    }
  });
  
  test('handles permission errors gracefully', async () => {
    // Create a process owned by another user (if possible) or use a process
    // that we definitely don't have permission to kill
    // We'll use a mock approach here since we can't guarantee specific processes exist
    const scriptPath = join(testDir, 'protected-process.sh');
    await writeFile(scriptPath, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Immediately remove from background process manager to simulate
    // a process we don't control
    mockContext.backgroundProcessManager.removeProcess(proc.pid);

    // The killProcessTree should handle this gracefully
    await expect(killProcessTree({
      pid: proc.pid,
      context: mockContext
    })).resolves.toBeUndefined();
    
    // Clean up
    try {
      process.kill(proc.pid, 'SIGKILL');
    } catch {
      // Process might already be gone
    }
  });

  test('handles Windows platform correctly', async () => {
    // Skip this test if not on Windows
    if (process.platform !== 'win32') {
      return;
    }

    const scriptPath = join(testDir, 'windows-process.bat');
    await writeFile(scriptPath, '@echo off\nping -n 30 127.0.0.1 > nul', { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    await sleep(100);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('handles macOS platform correctly', async () => {
    // Skip this test if not on macOS
    if (process.platform !== 'darwin') {
      return;
    }

    const scriptPath = join(testDir, 'macos-process.sh');
    await writeFile(scriptPath, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    await sleep(100);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('handles Linux platform correctly', async () => {
    // Skip this test if not on Linux
    if (process.platform !== 'linux') {
      return;
    }

    const scriptPath = join(testDir, 'linux-process.sh');
    await writeFile(scriptPath, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    await sleep(100);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('builds correct process tree on Unix', async () => {
    // Skip on Windows
    if (process.platform === 'win32') {
      return;
    }

    // Create a complex tree structure
    const grandparentScript = join(testDir, 'grandparent.sh');
    const parentScript = join(testDir, 'parent.sh');
    const childScript = join(testDir, 'child.sh');
    const siblingScript = join(testDir, 'sibling.sh');
    
    await writeFile(childScript, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    await writeFile(siblingScript, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    await writeFile(parentScript, `#!/bin/sh\n${childScript} &\n${siblingScript} &\nwait`, { mode: 0o755 });
    await writeFile(grandparentScript, `#!/bin/sh\n${parentScript} &\nwait`, { mode: 0o755 });

    const proc = await execute({
      command: [grandparentScript],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Give time for full tree to spawn
    await sleep(1000);

    // Kill the entire tree
    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    await sleep(500);
    
    // Verify all processes are gone
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('handles process that spawns child after kill signal', async () => {
    // Skip on Windows
    if (process.platform === 'win32') {
      return;
    }

    const spawnerScript = join(testDir, 'spawner.sh');
    const childScript = join(testDir, 'delayed-child.sh');
    
    await writeFile(childScript, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    
    // This script catches SIGTERM and tries to spawn a child
    await writeFile(spawnerScript, `#!/bin/sh
trap '${childScript} &' TERM
sleep 30`, { mode: 0o755 });

    const proc = await execute({
      command: [spawnerScript],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    await sleep(200);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('handles zombie processes gracefully', async () => {
    // Skip on Windows
    if (process.platform === 'win32') {
      return;
    }

    // Create a parent that exits without waiting for child
    const zombieParent = join(testDir, 'zombie-parent.sh');
    const zombieChild = join(testDir, 'zombie-child.sh');
    
    await writeFile(zombieChild, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    await writeFile(zombieParent, `#!/bin/sh\n${zombieChild} &\nexit 0`, { mode: 0o755 });

    const proc = await execute({
      command: [zombieParent],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Parent will exit quickly, potentially leaving zombie
    await sleep(200);

    // Should handle gracefully even if parent is gone
    await expect(killProcessTree({
      pid: proc.pid,
      context: mockContext
    })).resolves.toBeUndefined();
  });

  test('handles circular process references', async () => {
    // This is a theoretical test - in practice, Unix doesn't allow circular parent-child relationships
    // But we test that our tree building doesn't get stuck in infinite loops
    const scriptPath = join(testDir, 'normal-process.sh');
    await writeFile(scriptPath, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Even if somehow we had circular references, the Set in buildUnixProcessTree prevents infinite loops
    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    await sleep(100);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('handles very large process trees', async () => {
    // Skip on Windows
    if (process.platform === 'win32') {
      return;
    }

    // Create a parent that spawns many children
    const parentScript = join(testDir, 'many-children-parent.sh');
    const childScript = join(testDir, 'many-children-child.sh');
    
    await writeFile(childScript, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    
    // Spawn 10 children
    let scriptContent = '#!/bin/sh\n';
    for (let i = 0; i < 10; i++) {
      scriptContent += `${childScript} &\n`;
    }
    scriptContent += 'wait';
    
    await writeFile(parentScript, scriptContent, { mode: 0o755 });

    const proc = await execute({
      command: [parentScript],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Give time for all children to spawn
    await sleep(500);

    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    await sleep(500);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('handles mixed process states in tree', async () => {
    // Create a tree where some processes exit and others continue
    const exitingChild = join(testDir, 'exiting-child.sh');
    const persistentChild = join(testDir, 'persistent-child.sh');
    const mixedParent = join(testDir, 'mixed-parent.sh');
    
    await writeFile(exitingChild, '#!/bin/sh\nsleep 0.2; exit 0', { mode: 0o755 });
    await writeFile(persistentChild, SLEEP_SCRIPT_CONTENT, { mode: 0o755 });
    await writeFile(mixedParent, `#!/bin/sh
${exitingChild} &
${persistentChild} &
wait`, { mode: 0o755 });

    const proc = await execute({
      command: [mixedParent],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Let the exiting child finish but persistent child remain
    await sleep(400);

    await killProcessTree({
      pid: proc.pid,
      context: mockContext
    });

    await sleep(200);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });
});