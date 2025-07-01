// This file provides the core subprocess execution utility for the Panfactum CLI
// It handles command execution with retries, streaming output, and error handling

import { ReadableStreamDefaultReader } from "node:stream/web";
import { CLISubprocessError } from "@/util/error/error";
import { concatStreams } from "@/util/streams/concatStreams";
import { addBackgroundProcess } from "@/util/subprocess/killBackgroundProcess";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Function type for determining if a subprocess execution was successful
 * 
 * @param results - The execution results to evaluate
 * @returns True if the execution should be considered successful
 */
type IsSuccessFn = (results: {
  /** Standard output from the subprocess */
  stdout: string;
  /** Standard error from the subprocess */
  stderr: string;
  /** Exit code from the subprocess */
  exitCode: number;
}) => boolean;

/**
 * Input parameters for executing a subprocess command
 */
export interface IExecuteInput {
  /** Command and arguments to execute */
  command: string[];
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Directory to execute the command in */
  workingDirectory: string;
  /** Custom error message if execution fails */
  errorMessage?: string;
  /** Environment variables to pass to the subprocess */
  env?: Record<string, string | undefined>;
  /** Number of times to retry on failure (default: 0) */
  retries?: number;
  /** Delay in milliseconds between retries (default: 5000) */
  retryDelay?: number;
  /** Callback invoked for each stdout line */
  onStdOutNewline?: (line: string, runNum: number) => void;
  /** Callback invoked for each stderr line */
  onStdErrNewline?: (line: string, runNum: number) => void;
  /** Callback invoked before each retry attempt */
  retryCallback?: (attemptNumber: number, lastResults: IExecuteOutput) => void;
  /** Custom function to determine if execution was successful */
  isSuccess?: IsSuccessFn;
  /** Input stream for the subprocess */
  stdin?:
  | globalThis.Request
  | globalThis.ReadableStream
  | globalThis.File
  | globalThis.Blob
  | number
  | "inherit"
  | null;
  /** Whether to run the process in the background */
  background?: boolean;
  /** Description for background process tracking */
  backgroundDescription?: string;
}


/**
 * Output from subprocess execution
 */
export interface IExecuteOutput {
  /** Standard output from the subprocess */
  stdout: string;
  /** Standard error from the subprocess */
  stderr: string;
  /** Exit code from the subprocess */
  exitCode: number;
  /** Process ID of the subprocess */
  pid: number;
}


/**
 * Default success check - considers exit code 0 as success
 */
const defaultIsSuccess: IsSuccessFn = ({ exitCode }) => exitCode === 0;

/**
 * Executes a subprocess command with comprehensive error handling and retry logic
 * 
 * @remarks
 * This is the primary subprocess execution utility in the Panfactum CLI. It provides:
 * - Automatic retry logic with configurable delays
 * - Real-time streaming of stdout/stderr with line callbacks
 * - Background process support with PID tracking
 * - Custom success determination logic
 * - Comprehensive error messages with subprocess logs
 * 
 * @param inputs - Configuration for subprocess execution
 * @returns Execution results including stdout, stderr, exit code, and PID
 * 
 * @example
 * ```typescript
 * const result = await execute({
 *   command: ['terraform', 'apply'],
 *   context,
 *   workingDirectory: '/path/to/module',
 *   retries: 3,
 *   retryDelay: 10000
 * });
 * console.log(result.stdout);
 * ```
 * 
 * @example
 * ```typescript
 * // Execute with real-time output streaming
 * await execute({
 *   command: ['npm', 'install'],
 *   context,
 *   workingDirectory: process.cwd(),
 *   onStdOutNewline: (line) => console.log(`[npm] ${line}`),
 *   onStdErrNewline: (line) => console.error(`[npm error] ${line}`)
 * });
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when the subprocess fails to spawn or execute successfully
 * 
 * @see {@link IExecuteInput} - For detailed parameter documentation
 * @see {@link IExecuteOutput} - For output format
 */
export async function execute(inputs: IExecuteInput): Promise<IExecuteOutput> {
  const {
    command,
    context,
    workingDirectory,
    errorMessage,
    env,
    retries = 0,
    retryDelay = 5000,
    retryCallback,
    onStdOutNewline,
    onStdErrNewline,
    isSuccess = defaultIsSuccess,
    stdin = null,
    background = false,
    backgroundDescription,
  } = inputs;
  
  // Background processes always ignore output, foreground processes always pipe
  const stdoutOption = background ? "ignore" : "pipe";
  const stderrOption = background ? "ignore" : "pipe";
  let logsBuffer = "";
  for (let i = 0; i < retries + 1; i++) {
    let proc;
    try {
      proc = Bun.spawn(command, {
        cwd: workingDirectory,
        env,
        stdout: stdoutOption,
        stderr: stderrOption,
        stdin,
      });
    } catch (e) {
      throw new CLISubprocessError("Failed to spawn subprocess", {
        command: command.join(" "),
        subprocessLogs: e instanceof Error ? e.message : String(e),
        workingDirectory,
      });
    }
    
    // For background processes, return immediately with PID
    if (background) {
      // Track the background process
      addBackgroundProcess({
        pid: proc.pid,
        command: command.join(' '),
        description: backgroundDescription
      });
      
      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
        pid: proc.pid,
      };
    }
    
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
        i,
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
        i,
      );
      stderrCallbackPromise = stderrReader.read().then(stderrProcessor);
    }

    const stdoutPromise = new globalThis.Response(stdoutForCapture).text();
    const stderrPromise = new globalThis.Response(stderrForCapture).text();
    const mergedOutputStreams = concatStreams([stdoutForMerge, stderrForMerge]);
    const mergedOutputStreamsPromise = new globalThis.Response(
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

    context.logger.debug("Ran subproces", { command, exitCode, output: output });
    logsBuffer += output + "\n";

    const retValue = {
      exitCode,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
      pid: proc.pid,
    };
    if (isSuccess(retValue)) {
      return retValue;
    }

    if (retryCallback) {
      retryCallback(i + 1, retValue);
    }

    if (retries > 0) {
      await Bun.sleep(retryDelay);
    }
  }

  throw new CLISubprocessError(
    errorMessage ?? `Command failed to execute successfully`,
    {
      command: command.join(" "),
      subprocessLogs: logsBuffer,
      workingDirectory,
    }
  );
}

/**
 * Creates a processor for streaming text output line by line
 * 
 * @internal
 * @param reader - Stream reader for text data
 * @param processLine - Callback for each complete line
 * @param runNum - Current run number for retry tracking
 * @returns Async processor function
 */
const createTextOutputProcessor = (
  reader: ReadableStreamDefaultReader,
  processLine: (line: string, runNum: number) => void,
  runNum: number,
) => {
  let buffer = ""; // Buffer to store incomplete lines
  const decoder = new globalThis.TextDecoder("utf-8");

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
        processLine(lines[i]!, runNum);
      }

      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines[lines.length - 1]!;

      return reader.read().then(processor);
    } else {
      // Process any remaining content in the buffer when the stream is done
      if (buffer.length > 0) {
        processLine(buffer, runNum);
      }
      return Promise.resolve();
    }
  };

  return processor;
};
