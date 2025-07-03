// Unit tests for the BackgroundProcessManager class
// Tests process tracking, management, and cleanup functionality

import { rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { createTestDir } from '@/util/test/createTestDir';
import { sleep } from '@/util/util/sleep';
import { BackgroundProcessManager, type IBackgroundProcess } from './BackgroundProcessManager';
import { execute } from './execute';
import type { PanfactumContext } from '@/util/context/context';

describe('BackgroundProcessManager', () => {
  let testDir: string;
  let mockContext: PanfactumContext;
  let manager: BackgroundProcessManager;
  
  beforeEach(async () => {
    const result = await createTestDir({ functionName: 'BackgroundProcessManager' });
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
    
    manager = new BackgroundProcessManager(mockContext);
    // Attach the manager to the context so execute() can use it
    mockContext.backgroundProcessManager = manager;
  });

  afterEach(async () => {
    // Clean up any remaining processes
    await manager.killAllProcesses();
    await rmdir(testDir, { recursive: true });
  });

  test('tracks and removes processes correctly', () => {
    expect(manager.getProcessCount()).toBe(0);
    expect(manager.getProcesses()).toHaveLength(0);

    manager.addProcess({
      pid: 1234,
      command: 'test command',
      description: 'Test process'
    });

    expect(manager.getProcessCount()).toBe(1);
    expect(manager.getProcesses()).toHaveLength(1);
    expect(manager.findProcess(1234)).toMatchInlineSnapshot(`
{
  "command": "test command",
  "description": "Test process",
  "pid": 1234,
}
`);

    manager.removeProcess(1234);
    expect(manager.getProcessCount()).toBe(0);
    expect(manager.findProcess(1234)).toBeUndefined();
  });

  test('handles multiple processes', () => {
    manager.addProcess({ pid: 1001, command: 'cmd1' });
    manager.addProcess({ pid: 1002, command: 'cmd2' });
    manager.addProcess({ pid: 1003, command: 'cmd3' });

    expect(manager.getProcessCount()).toBe(3);
    
    const processes = manager.getProcesses();
    expect(processes).toHaveLength(3);
    expect(processes.map(p => p.pid).sort()).toEqual([1001, 1002, 1003]);

    manager.removeProcess(1002);
    expect(manager.getProcessCount()).toBe(2);
    expect(manager.findProcess(1002)).toBeUndefined();
    expect(manager.findProcess(1001)).toBeDefined();
    expect(manager.findProcess(1003)).toBeDefined();
  });

  test('getProcesses returns immutable copy', () => {
    manager.addProcess({ pid: 1234, command: 'test' });
    
    const processes1 = manager.getProcesses();
    const processes2 = manager.getProcesses();
    
    // Should be different array instances
    expect(processes1).not.toBe(processes2);
    
    // But same content
    expect(processes1).toEqual(processes2);
    
    // Modifying returned array should not affect manager
    // Cast to mutable array to test that we got a copy
    (processes1 as IBackgroundProcess[]).push({ pid: 5678, command: 'fake' });
    expect(manager.getProcessCount()).toBe(1);
  });

  test('clearProcesses removes all without killing', () => {
    manager.addProcess({ pid: 1001, command: 'cmd1' });
    manager.addProcess({ pid: 1002, command: 'cmd2' });
    
    expect(manager.getProcessCount()).toBe(2);
    
    manager.clearProcesses();
    
    expect(manager.getProcessCount()).toBe(0);
    expect(manager.getProcesses()).toHaveLength(0);
  });

  test('kills single process with default settings', async () => {
    // Create a real process to test killing
    const scriptPath = join(testDir, 'test-process.sh');
    await writeFile(scriptPath, '#!/bin/sh\nsleep 30', { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Verify process is running
    expect(() => process.kill(proc.pid, 0)).not.toThrow();
    
    // Process was already added by execute() through context.backgroundProcessManager
    expect(manager.findProcess(proc.pid)).toBeDefined();

    // Kill the process
    await manager.killProcess({ pid: proc.pid });

    // Give time for termination
    await sleep(200);

    // Verify process is gone
    expect(() => process.kill(proc.pid, 0)).toThrow();
    
    // Verify removed from tracking
    expect(manager.findProcess(proc.pid)).toBeUndefined();
  });

  test('kills process with custom timeout', async () => {
    // Create a process that ignores SIGTERM
    const scriptPath = join(testDir, 'stubborn-process.sh');
    await writeFile(scriptPath, `#!/bin/sh
trap '' TERM
sleep 30`, { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Process was already added by execute()
    expect(manager.findProcess(proc.pid)).toBeDefined();

    // Kill with short timeout to force SIGKILL
    await manager.killProcess({ 
      pid: proc.pid, 
      gracefulTimeoutMs: 100 
    });

    // Give time for force kill
    await sleep(300);

    // Verify process is gone
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('kills only main process when killChildren is false', async () => {
    const scriptPath = join(testDir, 'simple-process.sh');
    await writeFile(scriptPath, '#!/bin/sh\nsleep 30', { mode: 0o755 });
    
    const proc = await execute({
      command: [scriptPath],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Process was already added by execute()
    expect(manager.findProcess(proc.pid)).toBeDefined();

    await manager.killProcess({ 
      pid: proc.pid, 
      killChildren: false 
    });

    await sleep(200);
    expect(() => process.kill(proc.pid, 0)).toThrow();
  });

  test('handles non-existent process gracefully', async () => {
    const nonExistentPid = 999999;
    
    manager.addProcess({
      pid: nonExistentPid,
      command: 'fake command'
    });

    // Should not throw
    await expect(manager.killProcess({ pid: nonExistentPid })).resolves.toBeUndefined();
    
    // Give time for cleanup to complete
    await sleep(100);
    
    // Should be removed from tracking
    expect(manager.findProcess(nonExistentPid)).toBeUndefined();
  });

  test('killAllProcesses handles empty list', async () => {
    await expect(manager.killAllProcesses()).resolves.toBeUndefined();
    expect(mockContext.logger.debug).toHaveBeenCalledWith("No background processes to kill");
  });

  test('killAllProcesses kills multiple processes', async () => {
    // Create multiple test processes
    const script1Path = join(testDir, 'proc1.sh');
    const script2Path = join(testDir, 'proc2.sh');
    
    await writeFile(script1Path, '#!/bin/sh\nsleep 30', { mode: 0o755 });
    await writeFile(script2Path, '#!/bin/sh\nsleep 30', { mode: 0o755 });
    
    const proc1 = await execute({
      command: [script1Path],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });
    
    const proc2 = await execute({
      command: [script2Path],
      context: mockContext,
      workingDirectory: testDir,
      background: true
    });

    // Processes were already added by execute()
    expect(manager.getProcessCount()).toBe(2);
    expect(manager.findProcess(proc1.pid)).toBeDefined();
    expect(manager.findProcess(proc2.pid)).toBeDefined();

    await manager.killAllProcesses();

    // Give time for termination
    await sleep(300);

    // Verify both processes are gone
    expect(() => process.kill(proc1.pid, 0)).toThrow();
    expect(() => process.kill(proc2.pid, 0)).toThrow();
    
    // Verify tracking is cleared
    expect(manager.getProcessCount()).toBe(0);
  });

  test('logs process operations', () => {
    manager.addProcess({
      pid: 1234,
      command: 'test command',
      description: 'Test process'
    });

    expect(mockContext.logger.debug).toHaveBeenCalledWith(
      'Added background process to tracking: PID 1234 - test command'
    );

    manager.removeProcess(1234);

    expect(mockContext.logger.debug).toHaveBeenCalledWith(
      'Removed background process from tracking: PID 1234 - test command'
    );
  });
});