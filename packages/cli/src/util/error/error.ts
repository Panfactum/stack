import { ZodError } from "zod";

export class CLIError extends Error {
  constructor(message: string | string[], error?: unknown) {
    const formattedMessage =
      typeof message === "string" ? message : message.join("\n");
    if (error instanceof Error) {
      super(`${formattedMessage}: ${error.message}`, { cause: error });
    } else if (error !== undefined) {
      super(`${formattedMessage}: ${JSON.stringify(error)}`);
    } else {
      super(formattedMessage);
    }
  }
}

export class CLIConfigFileValidationError extends CLIError {
  filePath: string;
  constructor(message: string, opts: { filePath: string }) {
    super(message);
    this.filePath = opts.filePath;
  }
}

export class CLISubprocessError extends CLIError {
  command: string;
  subprocessLogs: string;
  workingDirectory: string;

  constructor(
    message: string,
    opts: {
      command: string;
      subprocessLogs: string;
      workingDirectory: string;
    }
  ) {
    super(message);
    this.command = opts.command;
    this.subprocessLogs = opts.subprocessLogs;
    this.workingDirectory = opts.workingDirectory;
  }
}

export class PanfactumZodError extends CLIError {
  location: string;
  validationError: ZodError;
  constructor(message: string, location: string, error: ZodError) {
    super(message, error);
    this.location = location;
    this.validationError = error;
  }
}