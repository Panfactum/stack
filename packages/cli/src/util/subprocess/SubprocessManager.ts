// This file provides the unified subprocess manager for the Panfactum CLI.
// It owns the singleton SIGINT/SIGTERM/SIGHUP/SIGQUIT listeners, dispatches
// signals to every live subprocess registration, tracks running processes
// for observability, and exposes the primary `execute` method used to spawn
// subprocesses.

import { ReadableStreamDefaultReader } from "node:stream/web";
import { CLISubprocessSpawnError } from "@/util/error/error";
import { concatStreams } from "@/util/streams/concatStreams";
import type { PanfactumBaseContext } from "@/util/context/context";
import type { Subprocess } from "bun";

/**
 * A subprocess with piped stdout/stderr. The stdin type is left flexible
 * because {@link IExecuteInput.stdin} permits many shapes.
 *
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IPipedOutputSubprocess = Subprocess<any, "pipe", "pipe">;

/**
 * Per-signal handler for a registered subprocess.
 *
 * @remarks
 * - `"forward"` sends the signal to the subprocess process group via
 *   `process.kill(-proc.pid, signal)` so that grandchildren are also signaled.
 * - `"ignore"` performs no action.
 * - A function receives the subprocess and may return a `Promise`; any rejection
 *   is caught and forwarded to `context.logger.error`.
 */
export type ISignalHandler =
  | "forward"
  | "ignore"
  | ((proc: Subprocess) => void | Promise<void>);

/**
 * Input for {@link SubprocessManager.register}.
 */
export interface IRegisterInput {
  /** The subprocess to signal */
  proc: Subprocess;
  /** Command string that was executed (used for observability) */
  command: string;
  /** Optional human-readable description of what the process is doing */
  description?: string;
  /** Handler invoked when the parent process receives SIGINT */
  onSigInt: ISignalHandler;
  /** Handler invoked when the parent process receives SIGTERM */
  onSigTerm: ISignalHandler;
  /** Handler invoked when the parent process receives SIGHUP */
  onSigHup: ISignalHandler;
  /** Handler invoked when the parent process receives SIGQUIT */
  onSigQuit: ISignalHandler;
  /**
   * If set, schedules a SIGKILL to the subprocess process group this many
   * milliseconds after the first SIGINT or SIGTERM is dispatched, or after
   * the `abortSignal` fires. Subsequent dispatches do NOT reschedule the
   * timer, and the abort path and OS-signal path share the same timer slot
   * so only one SIGKILL is ever scheduled per subprocess.
   */
  autoEscalateToSigKillMs?: number;
  /**
   * If set, tracks the most-recent dispatch timestamp per signal type. When
   * a second SIGINT (or SIGTERM) arrives within this many milliseconds of the
   * first, SIGKILL is sent immediately BEFORE running the registration's handler.
   * SIGINT and SIGTERM counts are tracked independently.
   */
  autoEscalateToSigKillOnRepeatWithinMs?: number;
  /**
   * Optional abort signal. When aborted, the manager sends SIGINT to the
   * subprocess process group and (if `autoEscalateToSigKillMs` is set)
   * schedules a SIGKILL using the same escalation timer slot as the
   * OS-signal path.
   *
   * @remarks
   * The manager owns the abort listener lifecycle — it is installed on
   * registration and automatically removed when the registration is
   * unregistered.
   */
  abortSignal?: AbortSignal;
}

/**
 * Per-invocation registration held inside the manager.
 *
 * @internal
 */
interface ISubprocessRegistration {
  /** The subprocess being tracked */
  proc: Subprocess;
  /** Command string that was executed */
  command: string;
  /** Optional description */
  description?: string;
  /** Handler invoked when the parent process receives SIGINT */
  onSigInt: ISignalHandler;
  /** Handler invoked when the parent process receives SIGTERM */
  onSigTerm: ISignalHandler;
  /** Handler invoked when the parent process receives SIGHUP */
  onSigHup: ISignalHandler;
  /** Handler invoked when the parent process receives SIGQUIT */
  onSigQuit: ISignalHandler;
  /** Optional SIGKILL escalation window (ms) */
  autoEscalateToSigKillMs?: number;
  /** Optional rapid-repeat SIGKILL escalation window (ms) */
  autoEscalateToSigKillOnRepeatWithinMs?: number;
}

/**
 * Public-facing process descriptor returned by
 * {@link SubprocessManager.getTrackedProcesses} and related accessors.
 */
export interface ITrackedProcessInfo {
  /** Process ID of the subprocess */
  pid: number;
  /** Command string that was executed */
  command: string;
  /** Optional description of what the process is doing */
  description?: string;
}

/**
 * Input parameters for {@link SubprocessManager.execute}.
 *
 * @remarks
 * Every subprocess is spawned with `detached: true` so it owns its own POSIX
 * process group. This means signals are sent via `process.kill(-proc.pid, signal)`
 * (negative PID) to reach grandchildren as well. If the parent process is
 * SIGKILL'd, child process groups that have not yet received their own SIGKILL
 * become orphaned — callers that care about this edge case should register an
 * `onForceKilled` callback to handle cleanup.
 */
export interface IExecuteInput {
  /** Command and arguments to execute */
  command: string[];
  /** Directory to execute the command in */
  workingDirectory: string;
  /** Environment variables to pass to the subprocess */
  env?: Record<string, string | undefined>;
  /** Callback invoked for each stdout line */
  onStdOutNewline?: (line: string) => void;
  /** Callback invoked for each stderr line */
  onStdErrNewline?: (line: string) => void;
  /** Input stream for the subprocess */
  stdin?:
  | Request
  | ReadableStream
  | File
  | Blob
  | Uint8Array
  | number
  | "inherit"
  | null;
  /**
   * Optional human-readable description of what the process is doing. Used
   * for observability via {@link SubprocessManager.getTrackedProcesses}.
   */
  description?: string;
  /**
   * Optional abort signal that gracefully terminates the running subprocess
   * when fired.
   *
   * @remarks
   * When the signal is aborted, the subprocess process group is sent SIGINT
   * so it — and all grandchildren — have a chance to perform their own
   * graceful shutdown (closing file handles, releasing external resources,
   * etc.) before exiting. If {@link IExecuteInput.autoEscalateToSigKillMs}
   * is set, the subprocess process group is force-killed with SIGKILL after
   * that many milliseconds if it has not exited on its own; otherwise the
   * subprocess is given an unbounded grace period to exit.
   *
   * The {@link IExecuteHandle.exited} promise still resolves with the
   * usual {@link IExecuteOutput} when the subprocess exits after an abort —
   * no error is thrown automatically. Callers that need to distinguish
   * aborted runs should inspect `abortSignal.aborted` alongside the
   * returned exit code.
   */
  abortSignal?: AbortSignal;
  /**
   * Handler invoked when the parent process receives SIGINT.
   *
   * @remarks
   * Defaults to `"forward"`, which sends SIGINT to the subprocess process
   * group via `process.kill(-proc.pid, "SIGINT")`. Set to `"ignore"` to
   * opt out, or provide a function for custom behavior.
   *
   * @see {@link ISignalHandler}
   */
  onSigInt?: ISignalHandler;
  /**
   * Handler invoked when the parent process receives SIGTERM.
   *
   * @remarks
   * Defaults to `"forward"`, which sends SIGTERM to the subprocess process
   * group via `process.kill(-proc.pid, "SIGTERM")`. Set to `"ignore"` to
   * opt out, or provide a function for custom behavior.
   *
   * @see {@link ISignalHandler}
   */
  onSigTerm?: ISignalHandler;
  /**
   * Handler invoked when the parent process receives SIGHUP.
   *
   * @remarks
   * Defaults to `"ignore"`. Set to `"forward"` or provide a function for
   * custom behavior.
   *
   * @see {@link ISignalHandler}
   */
  onSigHup?: ISignalHandler;
  /**
   * Handler invoked when the parent process receives SIGQUIT.
   *
   * @remarks
   * Defaults to `"ignore"`. Set to `"forward"` or provide a function for
   * custom behavior.
   *
   * @see {@link ISignalHandler}
   */
  onSigQuit?: ISignalHandler;
  /**
   * Bounded grace period, in milliseconds, to wait after the first SIGINT
   * or SIGTERM before automatically escalating to SIGKILL.
   *
   * @remarks
   * When this option is set, {@link SubprocessManager} schedules a SIGKILL
   * to the subprocess process group this many milliseconds after the first
   * SIGINT or SIGTERM is dispatched, or after `abortSignal` fires. All
   * escalation paths share a single per-registration timer slot, so at most
   * one SIGKILL timer is ever scheduled per subprocess.
   *
   * When left undefined, the subprocess is given an unbounded grace period to
   * respond to SIGINT or SIGTERM.
   *
   * Setting this to `0` schedules the SIGKILL on the next event-loop tick
   * after the first SIGINT/SIGTERM — effectively "kill immediately after asking
   * nicely".
   */
  autoEscalateToSigKillMs?: number;
  /**
   * Window in milliseconds for detecting rapid-repeat SIGINT/SIGTERM.
   *
   * @remarks
   * When this option is set, {@link SubprocessManager} tracks the most-recent
   * dispatch timestamp per signal type. When a second SIGINT (or SIGTERM)
   * arrives within this many milliseconds of the first, SIGKILL is sent
   * immediately BEFORE running the registration's handler. SIGINT and SIGTERM
   * counts are tracked independently.
   */
  autoEscalateToSigKillOnRepeatWithinMs?: number;
  /**
   * Optional callback invoked after the subprocess has been force-killed
   * via SIGKILL.
   *
   * @remarks
   * This callback fires whenever `proc.signalCode === "SIGKILL"` after the
   * subprocess exits, regardless of whether the SIGKILL was sent by the
   * {@link SubprocessManager} escalation timer, the `abortSignal` path, or
   * an external `kill -9`. It does NOT fire on clean exit, on graceful
   * SIGINT/SIGTERM exit, or on program error exit codes.
   *
   * Errors thrown by this callback are caught and logged via
   * `this.context.logger.error` — they are never propagated.
   */
  onForceKilled?: () => void | Promise<void>;
}

/**
 * Output from subprocess execution
 */
export interface IExecuteOutput {
  /** Standard output from the subprocess */
  stdout: string;
  /** Standard error from the subprocess */
  stderr: string;
  /**
   * Time-ordered merge of stdout and stderr — useful for constructing
   * user-facing error messages that preserve the subprocess's output order.
   */
  output: string;
  /** Exit code from the subprocess */
  exitCode: number;
  /** Process ID of the subprocess */
  pid: number;
  /**
   * The last signal the subprocess received before exiting, if any.
   *
   * @remarks
   * Reflects `Bun.Subprocess.signalCode` at the moment the subprocess exits.
   * This is `null` when the subprocess exited of its own accord without
   * receiving a signal. When non-null, it is the name of the last signal
   * delivered — for example `"SIGINT"`, `"SIGTERM"`, or `"SIGKILL"`.
   *
   * Note that signals sent to a subprocess's process group may arrive at
   * the subprocess via any path (the {@link SubprocessManager} escalation
   * timer, the `abortSignal` path, an OS signal forwarded to the parent
   * process, or an external `kill`) — this field does not distinguish
   * between those sources.
   */
  signalCode: Subprocess["signalCode"];
  /**
   * Whether the subprocess was aborted via the {@link IExecuteInput.abortSignal}
   * (when provided by the caller) or the handle's
   * {@link IExecuteHandle.abortController} (when not).
   *
   * @remarks
   * This is `true` when the abort signal tied to the subprocess was in the
   * aborted state at the time the subprocess exited. It is independent of
   * {@link IExecuteOutput.exitCode} and {@link IExecuteOutput.signalCode} —
   * an aborted subprocess may still have exited cleanly (for example, if
   * it handled the graceful SIGINT and returned 0).
   */
  aborted: boolean;
}

/**
 * Handle returned synchronously from {@link SubprocessManager.execute}.
 *
 * @remarks
 * The caller decides how — or whether — to await the subprocess. Access the
 * currently-running PID synchronously via `pid`, and `await handle.exited`
 * when results are needed.
 *
 * The handle is intentionally NOT thenable — callers must access
 * {@link IExecuteHandle.exited} explicitly to wait for the subprocess. This
 * keeps the API honest: `execute` is synchronous, and the subprocess exit
 * promise is a distinct property.
 *
 * When no `abortSignal` is passed to {@link IExecuteInput}, `execute` creates
 * its own {@link AbortController} and exposes it here so callers can still
 * abort the subprocess programmatically. When a signal **was** supplied by the
 * caller, `abortController` is `undefined` — the caller already owns the
 * controller for that signal.
 *
 * @example
 * ```typescript
 * // Await completion
 * const { stdout } = await manager.execute({ command, workingDirectory }).exited;
 *
 * // Fire-and-forget with PID access
 * const handle = manager.execute({ command, workingDirectory });
 * console.log(`started pid ${handle.pid}`);
 * // ... later, optionally: await handle.exited;
 *
 * // Abort a subprocess that was started without a caller-supplied signal
 * const handle = manager.execute({ command, workingDirectory });
 * handle.abortController?.abort();
 * ```
 */
export interface IExecuteHandle {
  /**
   * Process ID of the currently running subprocess.
   */
  readonly pid: number;
  /**
   * Promise that resolves with the execution results when the subprocess
   * exits, regardless of exit code or abort state. Callers are responsible
   * for inspecting {@link IExecuteOutput.exitCode} themselves and throwing
   * their own errors if the result is unacceptable.
   */
  readonly exited: Promise<IExecuteOutput>;
  /**
   * The {@link AbortController} generated by `execute` when no
   * {@link IExecuteInput.abortSignal} was provided.
   *
   * @remarks
   * Call `.abort()` to gracefully terminate the subprocess. This is
   * `undefined` when the caller supplied their own `abortSignal`, because
   * in that case the caller already owns the corresponding controller.
   */
  readonly abortController: AbortController | undefined;
}

/**
 * Internal per-registration state maintained by the manager.
 *
 * @internal
 */
interface IInternalState {
  /** Pending SIGKILL escalation timer, if any */
  escalationTimer: ReturnType<typeof setTimeout> | undefined;
  /** Timestamp (ms) of the last SIGINT dispatch; 0 if never dispatched */
  lastSigintMs: number;
  /** Timestamp (ms) of the last SIGTERM dispatch; 0 if never dispatched */
  lastSigtermMs: number;
  /** Bound abort listener (so unregister can remove it) */
  abortListener?: () => void;
  /** Abort signal the listener was attached to */
  abortSignal?: AbortSignal;
}

/**
 * Unified subprocess manager for the Panfactum CLI.
 *
 * @remarks
 * Responsibilities:
 *
 * 1. **Signal dispatch.** The constructor installs exactly ONE listener per
 *    signal (SIGINT, SIGTERM, SIGHUP, SIGQUIT) and dispatches each incoming
 *    signal to every live registration. Each registration can specify a
 *    per-signal handler (`"forward"`, `"ignore"`, or a function), an optional
 *    SIGKILL escalation timer, and an optional rapid-repeat escalation window.
 *
 * 2. **Process tracking.** All live registrations are exposed via
 *    {@link SubprocessManager.getTrackedProcesses} and its variants so other
 *    code can introspect or list the currently running processes.
 *
 * Callers register a subprocess before spawning (or immediately after) and
 * invoke the returned unregister function when the subprocess exits. The
 * unregister function also clears any pending SIGKILL escalation timer and
 * removes any attached abort listener.
 *
 * The {@link SubprocessManager.dispatchSignal} method allows the top-level
 * cleanup routine in `index.ts` to trigger the same dispatch logic
 * programmatically without relying on OS signal delivery.
 */
export class SubprocessManager {
  /**
   * Set of all currently live registrations.
   */
  private readonly registrations = new Set<ISubprocessRegistration>();

  /**
   * Internal state keyed by registration identity.
   */
  private readonly state = new Map<ISubprocessRegistration, IInternalState>();

  /**
   * Creates a new {@link SubprocessManager} and immediately installs the
   * four singleton process-level signal listeners.
   *
   * @param context - Panfactum context used for error logging
   */
  constructor(private readonly context: PanfactumBaseContext) {
    process.on("SIGINT", () => {
      this.dispatchSync("SIGINT");
    });
    process.on("SIGTERM", () => {
      this.dispatchSync("SIGTERM");
    });
    process.on("SIGHUP", () => {
      this.dispatchSync("SIGHUP");
    });
    process.on("SIGQUIT", () => {
      this.dispatchSync("SIGQUIT");
    });
  }

  /**
   * Registers a subprocess for signal dispatch and process tracking.
   *
   * @remarks
   * The registration is added to an internal `Set` and associated with
   * fresh per-registration state (no pending timers, no prior signal history).
   * The registration will be included in the results of
   * {@link SubprocessManager.getTrackedProcesses} and related accessors.
   *
   * If `input.abortSignal` is provided, the manager installs an abort
   * listener that sends SIGINT to the subprocess process group and schedules
   * a SIGKILL escalation (shared with the OS-signal path).
   *
   * The returned function removes the registration, cancels any pending
   * SIGKILL escalation timer, and removes any abort listener.
   *
   * @param input - Registration parameters. See {@link IRegisterInput}
   * @returns An unregister function. Must be called when the subprocess exits.
   */
  public register(input: IRegisterInput): () => void {
    const registration: ISubprocessRegistration = {
      proc: input.proc,
      command: input.command,
      description: input.description,
      onSigInt: input.onSigInt,
      onSigTerm: input.onSigTerm,
      onSigHup: input.onSigHup,
      onSigQuit: input.onSigQuit,
      autoEscalateToSigKillMs: input.autoEscalateToSigKillMs,
      autoEscalateToSigKillOnRepeatWithinMs:
        input.autoEscalateToSigKillOnRepeatWithinMs,
    };

    const internalState: IInternalState = {
      escalationTimer: undefined,
      lastSigintMs: 0,
      lastSigtermMs: 0,
    };

    this.registrations.add(registration);
    this.state.set(registration, internalState);

    this.context.logger.debug(
      `Registered subprocess: PID ${registration.proc.pid} - ${registration.command}`
    );

    // Wire up abort handling. When the caller's signal fires, send SIGINT to
    // the subprocess process group so it — and all grandchildren — can
    // perform their own graceful shutdown before exiting, and then schedule
    // a SIGKILL via the shared escalation timer.
    if (input.abortSignal) {
      const onAbort = () => {
        try {
          process.kill(-input.proc.pid, "SIGINT");
        } catch {
          // Subprocess may have already exited; ignore.
        }
        this.scheduleEscalation(registration);
      };
      if (input.abortSignal.aborted) {
        onAbort();
      } else {
        internalState.abortListener = onAbort;
        internalState.abortSignal = input.abortSignal;
        input.abortSignal.addEventListener("abort", onAbort, { once: true });
      }
    }

    return () => {
      this.registrations.delete(registration);
      const s = this.state.get(registration);
      if (s?.escalationTimer !== undefined) {
        clearTimeout(s.escalationTimer);
      }
      if (s?.abortSignal && s.abortListener) {
        s.abortSignal.removeEventListener("abort", s.abortListener);
      }
      this.state.delete(registration);

      this.context.logger.debug(
        `Unregistered subprocess: PID ${registration.proc.pid} - ${registration.command}`
      );
    };
  }

  /**
   * Dispatches a signal to all live registrations.
   *
   * @remarks
   * This method is intended for use by the top-level cleanup routine in
   * `index.ts` and for unit tests. It performs the same dispatch logic as the
   * OS-triggered path without delivering a real signal to the process.
   *
   * @param signalName - The signal to dispatch
   */
  public async dispatchSignal(
    signalName: "SIGINT" | "SIGTERM" | "SIGHUP" | "SIGQUIT"
  ): Promise<void> {
    await this.dispatch(signalName);
  }

  /**
   * Returns a snapshot of all currently tracked processes.
   *
   * @returns Array of tracked process descriptors
   */
  public getTrackedProcesses(): ITrackedProcessInfo[] {
    const result: ITrackedProcessInfo[] = [];
    for (const reg of this.registrations) {
      result.push({
        pid: reg.proc.pid,
        command: reg.command,
        description: reg.description,
      });
    }
    return result;
  }

  /**
   * Returns the number of currently tracked processes.
   *
   * @returns Tracked process count
   */
  public getTrackedProcessCount(): number {
    return this.registrations.size;
  }

  /**
   * Finds a tracked process by PID.
   *
   * @param pid - Process ID to find
   * @returns Tracked process descriptor if found, undefined otherwise
   */
  public findTrackedProcess(pid: number): ITrackedProcessInfo | undefined {
    for (const reg of this.registrations) {
      if (reg.proc.pid === pid) {
        return {
          pid: reg.proc.pid,
          command: reg.command,
          description: reg.description,
        };
      }
    }
    return undefined;
  }

  /**
   * Executes a subprocess command, returning a handle synchronously.
   *
   * @remarks
   * The returned {@link IExecuteHandle} exposes:
   * - `pid`: the subprocess's PID
   * - `exited`: a promise that resolves with the execution results when the
   *   subprocess exits, regardless of exit code or abort state
   *
   * This method never throws based on the subprocess's exit code or abort
   * status. Callers are responsible for inspecting
   * {@link IExecuteOutput.exitCode} themselves and throwing their own errors
   * if the result is unacceptable.
   *
   * Callers decide whether to await `exited` inline, fire-and-forget, or
   * race it against other promises.
   *
   * Every subprocess is spawned with `detached: true` so it owns its own POSIX
   * process group. Signals are always sent to the entire process group via
   * `process.kill(-proc.pid, signal)` — this ensures grandchildren are also
   * signaled. If the parent process receives SIGKILL before forwarding a
   * signal to the subprocess process group, those grandchildren may be
   * orphaned; use `onForceKilled` to detect and clean up this condition.
   *
   * Signal handling is delegated to this manager via
   * {@link SubprocessManager.register}. The `onSigInt` and `onSigTerm`
   * options default to `"forward"` so that Ctrl+C still cancels subprocesses.
   *
   * This method runs the command exactly once — there is no built-in retry
   * logic. Callers that need retry behavior should implement it at the call
   * site.
   *
   * @param inputs - Configuration for subprocess execution. See {@link IExecuteInput}
   * @returns A handle with PID and exit promise. See {@link IExecuteHandle}
   *
   * @example
   * ```typescript
   * // Await completion and check exit code explicitly
   * const result = await context.subprocessManager.execute({
   *   command: ['terraform', 'apply'],
   *   workingDirectory: '/path/to/module',
   * }).exited;
   * if (result.exitCode !== 0) {
   *   throw new CLISubprocessError("terraform apply failed", {
   *     command: "terraform apply",
   *     subprocessLogs: result.output,
   *     workingDirectory: '/path/to/module',
   *   });
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Fire-and-forget with description tracking
   * const handle = context.subprocessManager.execute({
   *   command: ['vault', 'proxy'],
   *   workingDirectory: process.cwd(),
   *   description: 'Vault dev proxy',
   *   abortSignal: controller.signal,
   *   autoEscalateToSigKillMs: 5000,
   * });
   * console.log(`started vault proxy with pid ${handle.pid}`);
   * ```
   *
   * @throws {@link CLISubprocessSpawnError}
   * Throws synchronously when `Bun.spawn` fails (for example, when the
   * executable cannot be found). This is a subclass of
   * {@link CLISubprocessError}. This is the only situation in which
   * `execute` throws — it never throws based on the subprocess's exit code
   * or abort state.
   *
   * @see {@link IExecuteInput} - For detailed parameter documentation
   * @see {@link IExecuteHandle} - For handle shape
   */
  public execute(inputs: IExecuteInput): IExecuteHandle {
    const {
      command,
      workingDirectory,
      description,
      env,
      stdin = null,
      abortSignal: providedAbortSignal,
      onSigInt = "forward",
      onSigTerm = "forward",
      onSigHup = "ignore",
      onSigQuit = "ignore",
      autoEscalateToSigKillMs,
      autoEscalateToSigKillOnRepeatWithinMs,
    } = inputs;

    // If the caller did not supply an abort signal, generate our own
    // AbortController so the returned handle always has a way to cancel the
    // subprocess programmatically.
    let ownedController: AbortController | undefined;
    let abortSignal: AbortSignal | undefined;
    if (providedAbortSignal !== undefined) {
      abortSignal = providedAbortSignal;
    } else {
      ownedController = new AbortController();
      abortSignal = ownedController.signal;
    }

    // Spawn the subprocess synchronously so we can return a PID immediately.
    let proc: IPipedOutputSubprocess;
    try {
      proc = Bun.spawn(command, {
        cwd: workingDirectory,
        env,
        stdout: "pipe",
        stderr: "pipe",
        stdin,
        detached: true,
      }) as IPipedOutputSubprocess;
    } catch (e) {
      throw new CLISubprocessSpawnError("Failed to spawn subprocess", {
        command: command.join(" "),
        subprocessLogs: e instanceof Error ? e.message : String(e),
        workingDirectory,
      });
    }

    const unregister = this.register({
      proc,
      command: command.join(" "),
      description,
      onSigInt,
      onSigTerm,
      onSigHup,
      onSigQuit,
      autoEscalateToSigKillMs,
      autoEscalateToSigKillOnRepeatWithinMs,
      abortSignal,
    });

    const exited = this.runExecute(inputs, proc, unregister, abortSignal);

    return {
      pid: proc.pid,
      exited,
      abortController: ownedController,
    };
  }

  /**
   * Async body of {@link SubprocessManager.execute}. Handles stream capture
   * and waiting for exit. Always resolves with the execution results,
   * regardless of exit code.
   *
   * @internal
   */
  private async runExecute(
    inputs: IExecuteInput,
    proc: IPipedOutputSubprocess,
    unregister: () => void,
    abortSignal: AbortSignal,
  ): Promise<IExecuteOutput> {
    const {
      command,
      onStdOutNewline,
      onStdErrNewline,
      onForceKilled,
    } = inputs;

    // eslint-disable-next-line prefer-const
    let [stdoutForMerge, stdoutForCapture] = proc.stdout!.tee();
    // eslint-disable-next-line prefer-const
    let [stderrForMerge, stderrForCapture] = proc.stderr!.tee();

    let stdoutCallbackPromise = Promise.resolve();
    let stderrCallbackPromise = Promise.resolve();

    if (onStdOutNewline) {
      let stdoutForCallback;
      [stdoutForCapture, stdoutForCallback] = stdoutForCapture.tee();
      const stdoutReader = stdoutForCallback.getReader();
      const stdoutProcessor = createTextOutputProcessor(
        stdoutReader,
        onStdOutNewline,
      );
      stdoutCallbackPromise = stdoutReader.read().then(stdoutProcessor);
    }

    if (onStdErrNewline) {
      let sderrForCallback;
      [stderrForCapture, sderrForCallback] = stderrForCapture.tee();
      const stderrReader = sderrForCallback.getReader();
      const stderrProcessor = createTextOutputProcessor(
        stderrReader,
        onStdErrNewline,
      );
      stderrCallbackPromise = stderrReader.read().then(stderrProcessor);
    }

    const stdoutPromise = new Response(stdoutForCapture).text();
    const stderrPromise = new Response(stderrForCapture).text();
    const mergedOutputStreams = concatStreams({ streams: [stdoutForMerge, stderrForMerge] });
    const mergedOutputStreamsPromise = new Response(
      mergedOutputStreams
    ).text();

    const [exitCode, stdout, stderr, output] = await Promise.all([
      proc.exited,
      stdoutPromise,
      stderrPromise,
      mergedOutputStreamsPromise,
      stdoutCallbackPromise,
      stderrCallbackPromise,
    ]);

    // Fire onForceKilled if the subprocess was killed by SIGKILL. This
    // covers both the SubprocessManager escalation path and the abort-path
    // escalation, as well as any external `kill -9`.
    if (proc.signalCode === "SIGKILL" && onForceKilled) {
      try {
        await onForceKilled();
      } catch (err) {
        this.context.logger.error(
          `onForceKilled callback failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Unregister from this manager now that the subprocess has exited,
    // cancelling any pending SIGKILL escalation timer and removing any
    // attached abort listener.
    unregister();

    this.context.logger.debug("Ran subproces", { command, exitCode, output });

    return {
      exitCode,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
      output,
      pid: proc.pid,
      signalCode: proc.signalCode,
      aborted: abortSignal.aborted,
    };
  }

  /**
   * Synchronous OS-signal entry point.
   *
   * @remarks
   * Node.js/Bun does not await synchronous signal handlers. This method
   * fires the async dispatch as a fire-and-forget with top-level error
   * catching so failures never surface as unhandled rejections.
   *
   * @internal
   */
  private dispatchSync(
    signalName: "SIGINT" | "SIGTERM" | "SIGHUP" | "SIGQUIT"
  ): void {
    this.dispatch(signalName).catch((err: unknown) => {
      this.context.logger.error(
        `SubprocessManager: unhandled error during ${signalName} dispatch: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  }

  /**
   * Core dispatch implementation shared by both the sync OS path and the
   * public {@link SubprocessManager.dispatchSignal} method.
   *
   * @internal
   */
  private async dispatch(
    signalName: "SIGINT" | "SIGTERM" | "SIGHUP" | "SIGQUIT"
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const reg of this.registrations) {
      promises.push(this.dispatchToRegistration(reg, signalName));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Applies the appropriate handler for a single registration and manages
   * escalation state.
   *
   * @internal
   */
  private async dispatchToRegistration(
    reg: ISubprocessRegistration,
    signalName: "SIGINT" | "SIGTERM" | "SIGHUP" | "SIGQUIT"
  ): Promise<void> {
    const s = this.state.get(reg);
    if (!s) {
      // Registration was concurrently removed; skip.
      return;
    }

    // ── Rapid-repeat SIGKILL escalation ────────────────────────────────────
    // SIGINT and SIGTERM are tracked independently. On the *second* signal
    // within the configured window, SIGKILL is sent immediately BEFORE
    // running the registration's normal handler.
    if (reg.autoEscalateToSigKillOnRepeatWithinMs !== undefined) {
      if (signalName === "SIGINT") {
        const now = Date.now();
        const prev = s.lastSigintMs;
        s.lastSigintMs = now;
        if (prev > 0 && now - prev < reg.autoEscalateToSigKillOnRepeatWithinMs) {
          this.sendSigKill(reg);
        }
      } else if (signalName === "SIGTERM") {
        const now = Date.now();
        const prev = s.lastSigtermMs;
        s.lastSigtermMs = now;
        if (prev > 0 && now - prev < reg.autoEscalateToSigKillOnRepeatWithinMs) {
          this.sendSigKill(reg);
        }
      }
    }

    // ── autoEscalateToSigKillMs timer (shared slot) ────────────────────────
    if (signalName === "SIGINT" || signalName === "SIGTERM") {
      this.scheduleEscalation(reg);
    }

    // ── Determine and run the per-signal handler ────────────────────────────
    const handler = this.handlerForSignal(reg, signalName);
    await this.dispatchHandler(reg, handler, signalName);
  }

  /**
   * Schedules a SIGKILL escalation timer for the registration, if one is
   * not already pending and `autoEscalateToSigKillMs` is set.
   *
   * @remarks
   * This is the single entry point for scheduling the SIGKILL escalation
   * timer. Both the OS-signal dispatch path ({@link dispatchToRegistration})
   * and the abort-signal path ({@link register}) call into this method, so
   * a given registration can only have ONE pending escalation timer at a
   * time.
   *
   * @internal
   */
  private scheduleEscalation(reg: ISubprocessRegistration): void {
    const s = this.state.get(reg);
    if (!s) return;
    if (reg.autoEscalateToSigKillMs === undefined) return;
    if (s.escalationTimer !== undefined) return;
    s.escalationTimer = setTimeout(() => {
      this.sendSigKill(reg);
    }, reg.autoEscalateToSigKillMs);
  }

  /**
   * Returns the per-signal handler from a registration.
   *
   * @internal
   */
  private handlerForSignal(
    reg: ISubprocessRegistration,
    signalName: "SIGINT" | "SIGTERM" | "SIGHUP" | "SIGQUIT"
  ): ISignalHandler {
    switch (signalName) {
      case "SIGINT":
        return reg.onSigInt;
      case "SIGTERM":
        return reg.onSigTerm;
      case "SIGHUP":
        return reg.onSigHup;
      case "SIGQUIT":
        return reg.onSigQuit;
    }
  }

  /**
   * Executes a single {@link ISignalHandler} against the given subprocess,
   * catching and logging any errors from function handlers.
   *
   * @internal
   */
  private async dispatchHandler(
    reg: ISubprocessRegistration,
    handler: ISignalHandler,
    signal: "SIGINT" | "SIGTERM" | "SIGHUP" | "SIGQUIT"
  ): Promise<void> {
    if (handler === "ignore") {
      return;
    }
    if (handler === "forward") {
      try {
        process.kill(-reg.proc.pid, signal);
      } catch {
        // Subprocess may have already exited; ignore.
      }
      return;
    }
    try {
      await handler(reg.proc);
    } catch (err) {
      this.context.logger.error(
        `Signal handler for ${signal} failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Sends SIGKILL to the subprocess process group, ignoring errors (the
   * process may have already exited).
   *
   * @internal
   */
  private sendSigKill(reg: ISubprocessRegistration): void {
    try {
      process.kill(-reg.proc.pid, "SIGKILL");
    } catch {
      // Subprocess may have already exited; ignore.
    }
  }
}

/**
 * Creates a processor for streaming text output line by line
 *
 * @internal
 * @param reader - Stream reader for text data
 * @param processLine - Callback for each complete line
 * @returns Async processor function
 */
const createTextOutputProcessor = (
  reader: ReadableStreamDefaultReader,
  processLine: (line: string) => void,
) => {
  let buffer = ""; // Buffer to store incomplete lines
  const decoder = new TextDecoder("utf-8");

  const processor = async (
    event: { done: true } | { done: false; value: Uint8Array }
  ): Promise<void> => {
    if (!event.done) {
      // Convert Uint8Array to string and add to buffer
      const text = decoder.decode(event.value);
      buffer += text;

      // Split by newlines
      const lines = buffer.split("\n");

      // Process all complete lines
      for (let i = 0; i < lines.length - 1; i++) {
        // Process each complete line
        processLine(lines[i]!);
      }

      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines[lines.length - 1]!;

      return reader.read().then(processor);
    } else {
      // Process any remaining content in the buffer when the stream is done
      if (buffer.length > 0) {
        processLine(buffer);
      }
      return Promise.resolve();
    }
  };

  return processor;
};
