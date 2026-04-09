// Unit tests for the SubprocessManager class.
// Covers signal dispatching, registration management, and escalation behaviors.

import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { CLISubprocessError, CLISubprocessSpawnError } from "@/util/error/error";
import { createTestDir } from "@/util/test/createTestDir";
import { sleep } from "@/util/util/sleep";
import { SubprocessManager } from "./SubprocessManager";
import type { PanfactumBaseContext } from "@/util/context/context";
import type { Subprocess } from "bun";

// Mock concatStreams to work around a bug where execute() passes an array
// directly instead of an object with streams property.
// NOTE: This uses global mock.module() intentionally to work around the bug.
// Do not refactor to spyOn pattern until the underlying bug is fixed.
mock.module("@/util/streams/concatStreams", () => ({
  concatStreams: (
    streamsOrInput:
      | ReadableStream[]
      | { streams: ReadableStream[] }
  ) => {
    const streams = Array.isArray(streamsOrInput)
      ? streamsOrInput
      : streamsOrInput.streams;
    return new ReadableStream({
      async start(controller) {
        try {
          for (const stream of streams) {
            const reader = stream.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  },
}));

/**
 * Creates a minimal mock context sufficient for SubprocessManager tests.
 *
 * @internal
 */
function createMockContext(): PanfactumBaseContext {
  return {
    logger: {
      debug: mock(() => {}),
      error: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
    },
  } as unknown as PanfactumBaseContext;
}

/**
 * Creates a fake Subprocess stand-in with the given PID.
 * Only the `pid` field is used by SubprocessManager for signal dispatch.
 *
 * @internal
 */
function makeFakeProc(pid: number): Subprocess {
  return { pid } as unknown as Subprocess;
}

describe("SubprocessManager", () => {
  let context: PanfactumBaseContext;
  let manager: SubprocessManager;
  let testDir: string;

  beforeEach(async () => {
    context = createMockContext();
    const result = await createTestDir({ functionName: "SubprocessManager" });
    testDir = result.path;
    manager = new SubprocessManager(context);
  });

  afterEach(async () => {
    mock.restore();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  // ── Listener installation ────────────────────────────────────────────────

  describe("constructor – single listener installation", () => {
    test("installs exactly one listener per signal", () => {
      const ctx = createMockContext();
      const beforeSigint = process.listenerCount("SIGINT");
      const beforeSigterm = process.listenerCount("SIGTERM");
      const beforeSighup = process.listenerCount("SIGHUP");
      const beforeSigquit = process.listenerCount("SIGQUIT");

      new SubprocessManager(ctx);

      expect(process.listenerCount("SIGINT")).toBe(beforeSigint + 1);
      expect(process.listenerCount("SIGTERM")).toBe(beforeSigterm + 1);
      expect(process.listenerCount("SIGHUP")).toBe(beforeSighup + 1);
      expect(process.listenerCount("SIGQUIT")).toBe(beforeSigquit + 1);
    });
  });

  // ── Register / unregister ────────────────────────────────────────────────

  describe("register / unregister", () => {
    test("registered handler is dispatched to", async () => {
      const handlerFn = mock(async () => {});
      const proc = makeFakeProc(99999);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: handlerFn,
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
      });

      await manager.dispatchSignal("SIGINT");
      expect(handlerFn).toHaveBeenCalledTimes(1);

      unregister();
    });

    test("unregistered handler is NOT dispatched to", async () => {
      const handlerFn = mock(async () => {});
      const proc = makeFakeProc(99999);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: handlerFn,
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
      });

      unregister();

      await manager.dispatchSignal("SIGINT");
      expect(handlerFn).toHaveBeenCalledTimes(0);
    });

    test("multiple registrations all receive dispatch", async () => {
      const fn1 = mock(async () => {});
      const fn2 = mock(async () => {});
      const proc1 = makeFakeProc(11111);
      const proc2 = makeFakeProc(22222);

      const unregister1 = manager.register({
        proc: proc1,
        command: "cmd1",
        onSigInt: fn1,
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
      });
      const unregister2 = manager.register({
        proc: proc2,
        command: "cmd2",
        onSigInt: fn2,
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
      });

      await manager.dispatchSignal("SIGINT");
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      unregister1();
      unregister2();
    });
  });

  // ── "forward" handler ────────────────────────────────────────────────────

  describe('"forward" handler', () => {
    test('sends process.kill with negative pid to the process group', async () => {
      const killSpy = spyOn(process, "kill");
      const fakePid = 54321;
      const proc = makeFakeProc(fakePid);

      // Mock process.kill so it doesn't throw (the process doesn't exist)
      killSpy.mockImplementation(() => true);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "forward",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
      });

      await manager.dispatchSignal("SIGINT");

      expect(killSpy).toHaveBeenCalledWith(-fakePid, "SIGINT");

      unregister();
    });

    test('uses process group kill (negative pid) end-to-end with a real subprocess', async () => {
      // Spawn a real subprocess in its own process group so we can verify
      // that process.kill(-pid) reaches it.
      const scriptPath = join(testDir, "group-signal-test.sh");
      await writeFile(scriptPath, "#!/bin/sh\nsleep 30", { mode: 0o755 });

      const proc = Bun.spawn([scriptPath], {
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
      });

      const unregister = manager.register({
        proc,
        command: scriptPath,
        onSigInt: "forward",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
      });

      // Verify process is running
      expect(() => process.kill(proc.pid, 0)).not.toThrow();

      // Forward SIGINT to the process group
      await manager.dispatchSignal("SIGINT");

      // Give the OS time to deliver the signal
      await sleep(200);

      // Process should have been terminated
      expect(() => process.kill(proc.pid, 0)).toThrow();

      unregister();
    });
  });

  // ── "ignore" handler ────────────────────────────────────────────────────

  describe('"ignore" handler', () => {
    test('does not call process.kill', async () => {
      const killSpy = spyOn(process, "kill");
      killSpy.mockImplementation(() => true);

      const proc = makeFakeProc(99998);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
      });

      await manager.dispatchSignal("SIGINT");

      expect(killSpy).not.toHaveBeenCalled();

      unregister();
    });
  });

  // ── Function handler ─────────────────────────────────────────────────────

  describe("function handler", () => {
    test("is invoked with the proc argument", async () => {
      const proc = makeFakeProc(77777);
      const handlerFn = mock(async (_p: Subprocess) => {});

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: handlerFn,
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
      });

      await manager.dispatchSignal("SIGINT");

      expect(handlerFn).toHaveBeenCalledTimes(1);
      expect(handlerFn).toHaveBeenCalledWith(proc);

      unregister();
    });

    test("errors from the function handler are caught and logged", async () => {
      const proc = makeFakeProc(88888);
      const thrower = mock(async () => {
        throw new Error("handler blew up");
      });

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: thrower,
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
      });

      // Should not throw
      await expect(manager.dispatchSignal("SIGINT")).resolves.toBeUndefined();

      expect(context.logger.error).toHaveBeenCalledTimes(1);
      expect((context.logger.error as ReturnType<typeof mock>).mock.calls[0]?.[0]).toContain(
        "handler blew up"
      );

      unregister();
    });
  });

  // ── autoEscalateToSigKillMs ──────────────────────────────────────────────

  describe("autoEscalateToSigKillMs", () => {
    test("schedules a SIGKILL after the configured delay on SIGINT", async () => {
      const killSpy = spyOn(process, "kill");
      killSpy.mockImplementation(() => true);

      const fakePid = 55555;
      const proc = makeFakeProc(fakePid);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
        autoEscalateToSigKillMs: 100,
      });

      await manager.dispatchSignal("SIGINT");

      // SIGKILL should not have been sent yet
      const killCallsAfterDispatch = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      expect(killCallsAfterDispatch).toBe(0);

      // Wait for timer to fire
      await sleep(200);

      const killCallsAfterDelay = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      expect(killCallsAfterDelay).toBe(1);

      unregister();
    });

    test("schedules a SIGKILL after the configured delay on SIGTERM", async () => {
      const killSpy = spyOn(process, "kill");
      killSpy.mockImplementation(() => true);

      const fakePid = 55556;
      const proc = makeFakeProc(fakePid);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
        autoEscalateToSigKillMs: 100,
      });

      await manager.dispatchSignal("SIGTERM");
      await sleep(200);

      const killCalls = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      expect(killCalls).toBe(1);

      unregister();
    });

    test("schedules SIGKILL exactly ONCE even when multiple signals arrive", async () => {
      const killSpy = spyOn(process, "kill");
      killSpy.mockImplementation(() => true);

      const fakePid = 55557;
      const proc = makeFakeProc(fakePid);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
        autoEscalateToSigKillMs: 150,
      });

      await manager.dispatchSignal("SIGINT");
      await manager.dispatchSignal("SIGTERM");
      await manager.dispatchSignal("SIGINT");

      await sleep(300);

      const sigkillCalls = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      // Only one escalation timer should have been set
      expect(sigkillCalls).toBe(1);

      unregister();
    });

    test("unregister clears the pending escalation timer", async () => {
      const killSpy = spyOn(process, "kill");
      killSpy.mockImplementation(() => true);

      const fakePid = 55558;
      const proc = makeFakeProc(fakePid);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
        autoEscalateToSigKillMs: 100,
      });

      await manager.dispatchSignal("SIGINT");

      // Unregister before the timer fires
      unregister();

      await sleep(200);

      const sigkillCalls = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      expect(sigkillCalls).toBe(0);
    });
  });

  // ── autoEscalateToSigKillOnRepeatWithinMs ────────────────────────────────

  describe("autoEscalateToSigKillOnRepeatWithinMs", () => {
    test("second SIGINT within window triggers immediate SIGKILL", async () => {
      const killSpy = spyOn(process, "kill");
      killSpy.mockImplementation(() => true);

      const fakePid = 44441;
      const proc = makeFakeProc(fakePid);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
        autoEscalateToSigKillOnRepeatWithinMs: 500,
      });

      await manager.dispatchSignal("SIGINT");

      // No SIGKILL yet (first dispatch)
      let sigkillCalls = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      expect(sigkillCalls).toBe(0);

      // Immediate second dispatch — well within the window
      await manager.dispatchSignal("SIGINT");

      sigkillCalls = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      expect(sigkillCalls).toBe(1);

      unregister();
    });

    test("second SIGTERM within window triggers immediate SIGKILL", async () => {
      const killSpy = spyOn(process, "kill");
      killSpy.mockImplementation(() => true);

      const fakePid = 44442;
      const proc = makeFakeProc(fakePid);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
        autoEscalateToSigKillOnRepeatWithinMs: 500,
      });

      await manager.dispatchSignal("SIGTERM");

      let sigkillCalls = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      expect(sigkillCalls).toBe(0);

      await manager.dispatchSignal("SIGTERM");

      sigkillCalls = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      expect(sigkillCalls).toBe(1);

      unregister();
    });

    test("second SIGINT OUTSIDE the window does NOT trigger immediate SIGKILL", async () => {
      const killSpy = spyOn(process, "kill");
      killSpy.mockImplementation(() => true);

      const fakePid = 44443;
      const proc = makeFakeProc(fakePid);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
        autoEscalateToSigKillOnRepeatWithinMs: 50,
      });

      await manager.dispatchSignal("SIGINT");

      // Wait longer than the window
      await sleep(100);

      await manager.dispatchSignal("SIGINT");

      // Should not have been SIGKILL-ed (second signal came too late)
      const sigkillCalls = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      expect(sigkillCalls).toBe(0);

      unregister();
    });

    test("SIGINT and SIGTERM repeat counts are independent", async () => {
      const killSpy = spyOn(process, "kill");
      killSpy.mockImplementation(() => true);

      const fakePid = 44444;
      const proc = makeFakeProc(fakePid);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
        autoEscalateToSigKillOnRepeatWithinMs: 500,
      });

      // One SIGINT followed by one SIGTERM — neither pair repeats
      await manager.dispatchSignal("SIGINT");
      await manager.dispatchSignal("SIGTERM");

      const sigkillCalls = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      // Alternating signals should NOT trigger the repeat escalation
      expect(sigkillCalls).toBe(0);

      unregister();
    });
  });

  // ── dispatchSignal ───────────────────────────────────────────────────────

  describe("dispatchSignal", () => {
    test("dispatches SIGHUP to registered handlers", async () => {
      const handlerFn = mock(async () => {});
      const proc = makeFakeProc(33333);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: handlerFn,
        onSigQuit: "ignore",
      });

      await manager.dispatchSignal("SIGHUP");
      expect(handlerFn).toHaveBeenCalledTimes(1);
      expect(handlerFn).toHaveBeenCalledWith(proc);

      unregister();
    });

    test("dispatches SIGQUIT to registered handlers", async () => {
      const handlerFn = mock(async () => {});
      const proc = makeFakeProc(33334);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "ignore",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: handlerFn,
      });

      await manager.dispatchSignal("SIGQUIT");
      expect(handlerFn).toHaveBeenCalledTimes(1);

      unregister();
    });

    test("performs the same dispatch as the OS-triggered path", async () => {
      // We cannot deliver real OS signals in tests without risking the test runner.
      // dispatchSignal is the canonical simulation mechanism; verify it exercises
      // the full dispatch path by checking all side-effects.
      const killSpy = spyOn(process, "kill");
      killSpy.mockImplementation(() => true);

      const fakePid = 22222;
      const proc = makeFakeProc(fakePid);

      const unregister = manager.register({
        proc,
        command: "test",
        onSigInt: "forward",
        onSigTerm: "ignore",
        onSigHup: "ignore",
        onSigQuit: "ignore",
        autoEscalateToSigKillMs: 100,
      });

      await manager.dispatchSignal("SIGINT");

      // "forward" sends kill with negative pid
      expect(killSpy).toHaveBeenCalledWith(-fakePid, "SIGINT");

      // Escalation timer fires after delay
      await sleep(200);
      const sigkillCalls = killSpy.mock.calls.filter(
        ([pid, sig]) => pid === -fakePid && sig === "SIGKILL"
      ).length;
      expect(sigkillCalls).toBe(1);

      unregister();
    });
  });

  // ── execute method ───────────────────────────────────────────────────────

  describe("execute", () => {
    /** Error message used when a subprocess does not become ready within the deadline */
    const SUBPROCESS_NEVER_READY = "subprocess never became ready";

    test("executes simple command successfully", async () => {
      const result = await manager.execute({
        command: ["echo", "hello world"],
        workingDirectory: testDir,
      }).exited;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("hello world");
      expect(result.stderr).toBe("");
      expect(result.output).toBe("hello world\n");
      expect(result.pid).toBeGreaterThan(0);
      expect(context.logger.debug).toHaveBeenCalledWith(
        "Ran subproces",
        expect.any(Object)
      );
    });

    test("captures stderr output on non-zero exit", async () => {
      const scriptPath = join(testDir, "stderr-test.sh");
      await writeFile(
        scriptPath,
        '#!/bin/sh\necho "error message" >&2\nexit 1',
        { mode: 0o755 }
      );

      const result = await manager.execute({
        command: [scriptPath],
        workingDirectory: testDir,
      }).exited;

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("error message");
      expect(result.output).toContain("error message");
    });

    test("does not throw on non-zero exit codes", async () => {
      const result = await manager.execute({
        command: ["false"],
        workingDirectory: testDir,
      }).exited;

      expect(result.exitCode).toBe(1);
    });

    test("passes environment variables", async () => {
      const result = await manager.execute({
        command: ["sh", "-c", "echo $TEST_VAR"],
        workingDirectory: testDir,
        env: { TEST_VAR: "test-value" },
      }).exited;

      expect(result.stdout).toBe("test-value");
    });

    test("calls stdout line callback", async () => {
      const lines: string[] = [];
      const onStdOutNewline = mock((line: string) => {
        lines.push(line);
      });

      await manager.execute({
        command: ["sh", "-c", 'echo "line1"; echo "line2"; echo "line3"'],
        workingDirectory: testDir,
        onStdOutNewline,
      }).exited;

      expect(lines).toMatchInlineSnapshot(`
        [
          "line1",
          "line2",
          "line3",
        ]
      `);
    });

    test("calls stderr line callback", async () => {
      const lines: string[] = [];
      const onStdErrNewline = mock((line: string) => {
        lines.push(line);
      });

      await manager.execute({
        command: ["sh", "-c", 'echo "err1" >&2; echo "err2" >&2'],
        workingDirectory: testDir,
        onStdErrNewline,
      }).exited;

      expect(lines).toMatchInlineSnapshot(`
        [
          "err1",
          "err2",
        ]
      `);
    });

    test("handles multiline output with callbacks", async () => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      const scriptPath = join(testDir, "multiline.sh");
      await writeFile(
        scriptPath,
        `#!/bin/sh
echo "stdout line 1"
echo "stderr line 1" >&2
echo "stdout line 2"
echo "stderr line 2" >&2
printf "no newline"`,
        { mode: 0o755 }
      );

      await manager.execute({
        command: [scriptPath],
        workingDirectory: testDir,
        onStdOutNewline: (line) => stdoutLines.push(line),
        onStdErrNewline: (line) => stderrLines.push(line),
      }).exited;

      expect(stdoutLines).toMatchInlineSnapshot(`
        [
          "stdout line 1",
          "stdout line 2",
          "no newline",
        ]
      `);
      expect(stderrLines).toMatchInlineSnapshot(`
        [
          "stderr line 1",
          "stderr line 2",
        ]
      `);
    });

    test.skip("stdin support with string", async () => {
      // Skipped: Bun currently has issues with ReadableStream support in spawn stdin
      // Error: "Re-enable ReadableStream support in spawn stdin."
      const input = "test input data";
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(input));
          controller.close();
        },
      });

      const result = await manager.execute({
        command: ["cat"],
        workingDirectory: testDir,
        stdin: stream,
      }).exited;

      expect(result.stdout).toBe(input);
    });

    test("throws CLISubprocessSpawnError synchronously on spawn failure", () => {
      expect(() =>
        manager.execute({
          command: ["/nonexistent/command"],
          workingDirectory: testDir,
        })
      ).toThrow(CLISubprocessSpawnError);

      // CLISubprocessSpawnError is a subclass of CLISubprocessError
      expect(() =>
        manager.execute({
          command: ["/nonexistent/command"],
          workingDirectory: testDir,
        })
      ).toThrow(CLISubprocessError);

      try {
        manager.execute({
          command: ["/nonexistent/command"],
          workingDirectory: testDir,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(CLISubprocessSpawnError);
        expect((error as CLISubprocessSpawnError).message).toContain(
          "Failed to spawn subprocess"
        );
      }
    });

    test("returns merged output in time order", async () => {
      const scriptPath = join(testDir, "failing.sh");
      await writeFile(
        scriptPath,
        `#!/bin/sh
echo "attempt output"
echo "attempt error" >&2
exit 1`,
        { mode: 0o755 }
      );

      const result = await manager.execute({
        command: [scriptPath],
        workingDirectory: testDir,
      }).exited;

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("attempt output");
      expect(result.output).toContain("attempt error");
    });

    test("handles empty command output", async () => {
      const result = await manager.execute({
        command: ["true"],
        workingDirectory: testDir,
      }).exited;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
      expect(result.output).toBe("");
      expect(result.pid).toBeGreaterThan(0);
    });

    test("handles commands with arguments containing spaces", async () => {
      const result = await manager.execute({
        command: ["echo", "hello world", "with spaces"],
        workingDirectory: testDir,
      }).exited;

      expect(result.stdout).toBe("hello world with spaces");
    });

    test("preserves exit code in output", async () => {
      const scriptPath = join(testDir, "exit42.sh");
      await writeFile(scriptPath, "#!/bin/sh\nexit 42", { mode: 0o755 });

      const result = await manager.execute({
        command: [scriptPath],
        workingDirectory: testDir,
      }).exited;

      expect(result.exitCode).toBe(42);
    });

    test("handles large output", async () => {
      // Generate large output
      const lines = 1000;
      const result = await manager.execute({
        command: [
          "sh",
          "-c",
          `i=1; while [ $i -le ${lines} ]; do echo "Line $i"; i=$((i+1)); done`,
        ],
        workingDirectory: testDir,
      }).exited;

      const outputLines = result.stdout.split("\n");
      expect(outputLines).toHaveLength(lines);
      expect(outputLines[0]).toBe("Line 1");
      expect(outputLines[lines - 1]).toBe(`Line ${lines}`);
    });

    test("respects working directory", async () => {
      const result = await manager.execute({
        command: ["pwd"],
        workingDirectory: testDir,
      }).exited;

      expect(result.stdout).toBe(testDir);
    });

    test("handles concurrent stream processing", async () => {
      const scriptPath = join(testDir, "concurrent.sh");
      await writeFile(
        scriptPath,
        `#!/bin/sh
i=1
while [ $i -le 5 ]; do
  echo "stdout $i"
  echo "stderr $i" >&2
  sleep 0.01
  i=$((i+1))
done`,
        { mode: 0o755 }
      );

      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      await manager.execute({
        command: [scriptPath],
        workingDirectory: testDir,
        onStdOutNewline: (line) => stdoutLines.push(line),
        onStdErrNewline: (line) => stderrLines.push(line),
      }).exited;

      expect(stdoutLines).toMatchInlineSnapshot(`
        [
          "stdout 1",
          "stdout 2",
          "stdout 3",
          "stdout 4",
          "stdout 5",
        ]
      `);
      expect(stderrLines).toMatchInlineSnapshot(`
        [
          "stderr 1",
          "stderr 2",
          "stderr 3",
          "stderr 4",
          "stderr 5",
        ]
      `);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Signal handling tests
    // ─────────────────────────────────────────────────────────────────────────

    describe("signal handling", () => {
      test("default onSigInt=forward: subprocess receives SIGINT and exits", async () => {
        // Script that traps SIGINT and exits with code 130
        const scriptPath = join(testDir, "sigint-trap.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
trap 'exit 130' INT
# Signal that we are ready by writing to the flag file
touch "${join(testDir, "ready")}"
while true; do sleep 0.05; done`,
          { mode: 0o755 }
        );

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
        }).exited;

        // Wait until the subprocess has started and is ready
        const deadline = Date.now() + 5000;
        while (!(await Bun.file(join(testDir, "ready")).exists())) {
          if (Date.now() > deadline) throw new Error(SUBPROCESS_NEVER_READY);
          await sleep(20);
        }

        // Simulate SIGINT arriving at the parent process
        await manager.dispatchSignal("SIGINT");

        const result = await executePromise;
        expect(result.exitCode).toBe(130);
      });

      test("onSigInt=ignore: subprocess does NOT receive SIGINT", async () => {
        // Script that does NOT trap SIGINT; it just runs and exits normally.
        // If SIGINT reached it, the default shell behavior would kill it.
        const scriptPath = join(testDir, "no-trap.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
touch "${join(testDir, "ready")}"
sleep 0.5
echo "clean exit"`,
          { mode: 0o755 }
        );

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
          onSigInt: "ignore",
        }).exited;

        // Wait until the subprocess has started
        const deadline = Date.now() + 5000;
        while (!(await Bun.file(join(testDir, "ready")).exists())) {
          if (Date.now() > deadline) throw new Error(SUBPROCESS_NEVER_READY);
          await sleep(20);
        }

        // Dispatch SIGINT — with ignore handler the subprocess should NOT be killed
        await manager.dispatchSignal("SIGINT");

        // Process should still complete normally
        const result = await executePromise;
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe("clean exit");
      });

      test("custom function handler is invoked with the proc argument", async () => {
        const scriptPath = join(testDir, "custom-handler.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
touch "${join(testDir, "ready")}"
# Wait for the kill file to appear then exit
while [ ! -f "${join(testDir, "kill")}" ]; do sleep 0.02; done
exit 0`,
          { mode: 0o755 }
        );

        let handlerPid: number | undefined;
        const customHandler = mock(async (proc: Subprocess) => {
          handlerPid = proc.pid;
          // Create the kill file so the subprocess exits
          await writeFile(join(testDir, "kill"), "");
        });

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
          onSigInt: customHandler,
        }).exited;

        const deadline = Date.now() + 5000;
        while (!(await Bun.file(join(testDir, "ready")).exists())) {
          if (Date.now() > deadline) throw new Error(SUBPROCESS_NEVER_READY);
          await sleep(20);
        }

        await manager.dispatchSignal("SIGINT");

        const result = await executePromise;
        expect(customHandler).toHaveBeenCalledTimes(1);
        expect(handlerPid).toBe(result.pid);
      });

      test("autoEscalateToSigKillMs causes SIGKILL after delay if subprocess does not exit", async () => {
        // Script ignores SIGINT intentionally to force the escalation timer to fire
        const scriptPath = join(testDir, "ignore-sigint.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
trap '' INT
touch "${join(testDir, "ready")}"
while true; do sleep 0.05; done`,
          { mode: 0o755 }
        );

        const onForceKilled = mock(() => {});

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
          onSigInt: "forward",
          autoEscalateToSigKillMs: 200,
          onForceKilled,
        }).exited;

        const deadline = Date.now() + 5000;
        while (!(await Bun.file(join(testDir, "ready")).exists())) {
          if (Date.now() > deadline) throw new Error(SUBPROCESS_NEVER_READY);
          await sleep(20);
        }

        await manager.dispatchSignal("SIGINT");

        await executePromise;
        expect(onForceKilled).toHaveBeenCalledTimes(1);
      });

      test("autoEscalateToSigKillOnRepeatWithinMs causes immediate SIGKILL on rapid repeat", async () => {
        const scriptPath = join(testDir, "repeat-sigint.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
trap '' INT
touch "${join(testDir, "ready")}"
while true; do sleep 0.05; done`,
          { mode: 0o755 }
        );

        const onForceKilled = mock(() => {});

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
          onSigInt: "forward",
          autoEscalateToSigKillOnRepeatWithinMs: 2000,
          onForceKilled,
        }).exited;

        const deadline = Date.now() + 5000;
        while (!(await Bun.file(join(testDir, "ready")).exists())) {
          if (Date.now() > deadline) throw new Error(SUBPROCESS_NEVER_READY);
          await sleep(20);
        }

        // First SIGINT — subprocess ignores it
        await manager.dispatchSignal("SIGINT");
        // Rapid second SIGINT — should trigger immediate SIGKILL
        await manager.dispatchSignal("SIGINT");

        await executePromise;
        expect(onForceKilled).toHaveBeenCalledTimes(1);
      });

      test("onForceKilled fires when subprocess is SIGKILL-ed via escalation timer", async () => {
        const scriptPath = join(testDir, "unkillable.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
trap '' INT TERM
touch "${join(testDir, "ready")}"
while true; do sleep 0.05; done`,
          { mode: 0o755 }
        );

        const onForceKilled = mock(() => {});

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
          onSigInt: "forward",
          autoEscalateToSigKillMs: 150,
          onForceKilled,
        }).exited;

        const deadline = Date.now() + 5000;
        while (!(await Bun.file(join(testDir, "ready")).exists())) {
          if (Date.now() > deadline) throw new Error(SUBPROCESS_NEVER_READY);
          await sleep(20);
        }

        await manager.dispatchSignal("SIGINT");
        await executePromise;

        expect(onForceKilled).toHaveBeenCalledTimes(1);
      });

      test("onForceKilled fires when subprocess is SIGKILL-ed externally (kill -9)", async () => {
        // Write the subprocess PID to a file so we can kill it externally
        const pidFile = join(testDir, "external-kill.pid");
        const scriptPath = join(testDir, "external-kill.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
echo $$ > "${pidFile}"
touch "${join(testDir, "ready")}"
while true; do sleep 0.05; done`,
          { mode: 0o755 }
        );

        const onForceKilled = mock(() => {});

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
          onForceKilled,
        }).exited;

        const deadline = Date.now() + 5000;
        while (!(await Bun.file(join(testDir, "ready")).exists())) {
          if (Date.now() > deadline) throw new Error(SUBPROCESS_NEVER_READY);
          await sleep(20);
        }

        // Read the PID from the file the subprocess wrote and kill its process group
        const pidText = await Bun.file(pidFile).text();
        const pid = parseInt(pidText.trim(), 10);
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          // May have exited already
        }

        await executePromise;
        expect(onForceKilled).toHaveBeenCalledTimes(1);
      });

      test("onForceKilled does NOT fire on clean exit", async () => {
        const onForceKilled = mock(() => {});

        const result = await manager.execute({
          command: ["true"],
          workingDirectory: testDir,
          onForceKilled,
        }).exited;

        expect(result.exitCode).toBe(0);
        expect(onForceKilled).not.toHaveBeenCalled();
      });

      test("onForceKilled does NOT fire on graceful SIGINT exit (signalCode=SIGINT)", async () => {
        const scriptPath = join(testDir, "graceful-sigint.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
trap 'exit 130' INT
touch "${join(testDir, "ready")}"
while true; do sleep 0.05; done`,
          { mode: 0o755 }
        );

        const onForceKilled = mock(() => {});

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
          onSigInt: "forward",
          onForceKilled,
        }).exited;

        const deadline = Date.now() + 5000;
        while (!(await Bun.file(join(testDir, "ready")).exists())) {
          if (Date.now() > deadline) throw new Error(SUBPROCESS_NEVER_READY);
          await sleep(20);
        }

        await manager.dispatchSignal("SIGINT");
        await executePromise;

        expect(onForceKilled).not.toHaveBeenCalled();
      });

      test("onForceKilled does NOT fire on program error exit codes", async () => {
        const onForceKilled = mock(() => {});

        const result = await manager.execute({
          command: ["false"],
          workingDirectory: testDir,
          onForceKilled,
        }).exited;

        expect(result.exitCode).toBe(1);
        expect(onForceKilled).not.toHaveBeenCalled();
      });

      test("onForceKilled errors are caught and logged via context.logger.error", async () => {
        const scriptPath = join(testDir, "force-kill-err.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
trap '' INT
touch "${join(testDir, "ready")}"
while true; do sleep 0.05; done`,
          { mode: 0o755 }
        );

        const onForceKilled = mock(async () => {
          throw new Error("cleanup failed");
        });

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
          onSigInt: "forward",
          autoEscalateToSigKillMs: 150,
          onForceKilled,
        }).exited;

        const deadline = Date.now() + 5000;
        while (!(await Bun.file(join(testDir, "ready")).exists())) {
          if (Date.now() > deadline) throw new Error(SUBPROCESS_NEVER_READY);
          await sleep(20);
        }

        await manager.dispatchSignal("SIGINT");
        await executePromise;

        expect(onForceKilled).toHaveBeenCalledTimes(1);
        expect(context.logger.error).toHaveBeenCalledWith(
          expect.stringContaining("onForceKilled callback failed")
        );
      });

      test("abortSignal integration: aborting sends SIGINT and escalation timer fires", async () => {
        const scriptPath = join(testDir, "abort-signal.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
trap '' INT
touch "${join(testDir, "ready")}"
while true; do sleep 0.05; done`,
          { mode: 0o755 }
        );

        const onForceKilled = mock(() => {});
        const abortController = new AbortController();

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
          abortSignal: abortController.signal,
          autoEscalateToSigKillMs: 200,
          onForceKilled,
        }).exited;

        const deadline = Date.now() + 5000;
        while (!(await Bun.file(join(testDir, "ready")).exists())) {
          if (Date.now() > deadline) throw new Error(SUBPROCESS_NEVER_READY);
          await sleep(20);
        }

        abortController.abort();

        await executePromise;
        expect(onForceKilled).toHaveBeenCalledTimes(1);
      });

      test("abortSignal already aborted fires immediately", async () => {
        const scriptPath = join(testDir, "already-aborted.sh");
        await writeFile(
          scriptPath,
          `#!/bin/sh
trap '' INT
sleep 10`,
          { mode: 0o755 }
        );

        const abortController = new AbortController();
        abortController.abort(); // Pre-aborted

        const executePromise = manager.execute({
          command: [scriptPath],
          workingDirectory: testDir,
          abortSignal: abortController.signal,
          autoEscalateToSigKillMs: 100,
        }).exited;

        // Should complete quickly because the abort fires immediately
        await executePromise;
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Nested execute() calls: signal dispatches to ALL live registrations
    // ─────────────────────────────────────────────────────────────────────────

    describe("nested execute() calls", () => {
      test("signal dispatched to parent reaches all live subprocess registrations", async () => {
        const scriptA = join(testDir, "nested-a.sh");
        const scriptB = join(testDir, "nested-b.sh");
        await writeFile(
          scriptA,
          `#!/bin/sh
trap 'exit 130' INT
touch "${join(testDir, "ready-a")}"
while true; do sleep 0.05; done`,
          { mode: 0o755 }
        );
        await writeFile(
          scriptB,
          `#!/bin/sh
trap 'exit 130' INT
touch "${join(testDir, "ready-b")}"
while true; do sleep 0.05; done`,
          { mode: 0o755 }
        );

        // Start both processes concurrently (nested execute calls)
        const promiseA = manager.execute({
          command: [scriptA],
          workingDirectory: testDir,
          onSigInt: "forward",
        }).exited;
        const promiseB = manager.execute({
          command: [scriptB],
          workingDirectory: testDir,
          onSigInt: "forward",
        }).exited;

        // Wait for both subprocesses to be ready
        const deadline = Date.now() + 5000;
        while (
          !(await Bun.file(join(testDir, "ready-a")).exists()) ||
          !(await Bun.file(join(testDir, "ready-b")).exists())
        ) {
          if (Date.now() > deadline)
            throw new Error("nested subprocesses never became ready");
          await sleep(20);
        }

        // Dispatch SIGINT once — should reach both registrations
        await manager.dispatchSignal("SIGINT");

        const [resultA, resultB] = await Promise.all([promiseA, promiseB]);
        expect(resultA.exitCode).toBe(130);
        expect(resultB.exitCode).toBe(130);
      });
    });
  });
});
