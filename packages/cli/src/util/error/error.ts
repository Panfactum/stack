import { ZodError } from "zod";

export class CLIError extends Error {
  constructor(message: string | string[], error?: unknown) {
    const formattedMessage =
      typeof message === "string" ? message : message.join("\n");
    if (error instanceof Error) {
      const newCause = error.cause || error
      super(`${formattedMessage}: ${error.message}`, { cause: newCause });
    } else if (error !== undefined) {
      super(`${formattedMessage}: ${JSON.stringify(error)}`);
    } else {
      super(formattedMessage);
    }
  }

  getDetailedMessage() {
    return ""
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

  override getDetailedMessage() {
    return `Command: ${this.command}\n` +
      `WorkingDirectory: ${this.workingDirectory}\n` +
      `Subprocess Logs:\n\n` + this.subprocessLogs
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

  override getDetailedMessage() {
    return `Location: ${this.location}\n` +
      `Validation Issues:\n\n` +
      this.validationError.issues.map(issue => `* ${issue.path.join(".")}: ${issue.message}`).join("\n")
  }
}