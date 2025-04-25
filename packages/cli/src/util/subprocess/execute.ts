import { ReadableStreamDefaultReader } from "node:stream/web";
import { applyColors } from "../colors/applyColors";
import { CLISubprocessError } from "../error/error";
import { concatStreams } from "../streams/concatStreams";
import type { PanfactumTaskWrapper } from "../listr/types";
import type { PanfactumContext } from "@/context/context";

type IsSuccessFn = (results: {
  stdout: string;
  stderr: string;
  exitCode: number;
}) => boolean;

interface ExecInputs {
  command: string[];
  context: PanfactumContext;
  workingDirectory: string;
  errorMessage?: string;
  env?: Record<string, string | undefined>;
  retries?: number;
  retryDelay?: number;
  onStdOutNewline?: (line: string, runNum: number) => void;
  onStdErrNewline?: (line: string, runNum: number) => void;
  retryCallback?: (attemptNumber: number, lastResults: ExecReturn) => void;
  isSuccess?: IsSuccessFn;
  stdin?:
    | globalThis.Request
    | globalThis.ReadableStream
    | globalThis.File
    | globalThis.Blob
    | number
    | "inherit"
    | null;
  task?: PanfactumTaskWrapper;
}

interface ExecReturn {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const defaultIsSuccess: IsSuccessFn = ({ exitCode }) => exitCode === 0;

// TODO: Add a way to stream this to the task.output
export async function execute(inputs: ExecInputs): Promise<ExecReturn> {
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
    task,
  } = inputs;
  let logsBuffer = "";
  for (let i = 0; i < retries + 1; i++) {
    let proc;
    try {
      proc = Bun.spawn(command, {
        cwd: workingDirectory,
        env,
        stdout: "pipe",
        stderr: "pipe",
        stdin,
      });
    } catch (e) {
      throw new CLISubprocessError("Failed to spawn subprocess", {
        command: command.join(" "),
        subprocessLogs: e instanceof Error ? e.message : String(e),
        workingDirectory,
      });
    }

    // eslint-disable-next-line prefer-const
    let [stdoutForMerge, stdoutForCapture] = proc.stdout.tee();
    // eslint-disable-next-line prefer-const
    let [stderrForMerge, stderrForCapture] = proc.stderr.tee();

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
        task
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
        task
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

    context.logger.log(output, { level: "debug" });
    logsBuffer += output + "\n";

    const retValue = {
      exitCode,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
    };
    if (isSuccess(retValue)) {
      return retValue;
    }

    if (retryCallback) {
      retryCallback(i + 1, retValue);
    }

    if (retries > 0) {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, retryDelay);
      });
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

const createTextOutputProcessor = (
  reader: ReadableStreamDefaultReader,
  processLine: (line: string, runNum: number) => void,
  runNum: number,
  task?: PanfactumTaskWrapper
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
        if (task) {
          task.output = applyColors(lines[i]!, { style: "subtle" });
        }
      }

      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines[lines.length - 1]!;

      return reader.read().then(processor);
    } else {
      // Process any remaining content in the buffer when the stream is done
      if (buffer.length > 0) {
        processLine(buffer, runNum);
        if (task) {
          task.output = applyColors(buffer, { style: "subtle" });
        }
      }
      return Promise.resolve();
    }
  };

  return processor;
};
