// This file defines custom error classes for the Panfactum CLI
// These provide structured error handling with detailed messages

import { ZodError } from "zod";

/**
 * Base error class for all CLI-related errors
 * 
 * @remarks
 * This class extends the native Error class and provides a consistent
 * error interface throughout the Panfactum CLI. It supports both single
 * and multi-line error messages and can wrap other errors as causes.
 * 
 * @example
 * ```typescript
 * throw new CLIError('Configuration file not found');
 * ```
 * 
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   throw new CLIError('Failed to complete operation', error);
 * }
 * ```
 */
export class CLIError extends Error {


  /**
   * Creates a new CLIError instance
   * 
   * @param message - Error message as a string or array of strings (for multi-line messages)
   * @param error - Optional underlying error that caused this error
   */
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

  /**
   * Gets a detailed error message for logging or debugging
   * 
   * @remarks
   * This method can be overridden by subclasses to provide
   * more specific error details.
   * 
   * @returns Detailed error message string
   */
  getDetailedMessage(): string {
    return ""
  }
}

/**
 * Interface for CLISubprocessError constructor options
 */
interface ICLISubprocessErrorOptions {
  /** The command that was executed */
  command: string;
  /** Logs output from the subprocess */
  subprocessLogs: string;
  /** Directory where the command was executed */
  workingDirectory: string;
}

/**
 * Error class for subprocess execution failures
 * 
 * @remarks
 * This error is thrown when a subprocess command fails to execute
 * properly. It includes detailed information about the command,
 * working directory, and subprocess output for debugging.
 * 
 * @example
 * ```typescript
 * throw new CLISubprocessError('Command failed', {
 *   command: 'terraform apply',
 *   subprocessLogs: 'Error: resource already exists',
 *   workingDirectory: '/home/user/project'
 * });
 * ```
 */
export class CLISubprocessError extends CLIError {
  /** The command that was executed */
  command: string;
  /** Logs output from the subprocess */
  subprocessLogs: string;
  /** Directory where the command was executed */
  workingDirectory: string;

  /**
   * Creates a new CLISubprocessError instance
   * 
   * @param message - Error message describing what went wrong
   * @param opts - Options containing subprocess execution details
   */
  constructor(
    message: string,
    opts: ICLISubprocessErrorOptions
  ) {
    super(message);
    this.command = opts.command;
    this.subprocessLogs = opts.subprocessLogs;
    this.workingDirectory = opts.workingDirectory;
  }

  /**
   * Gets detailed error message including command and logs
   * 
   * @returns Formatted error message with subprocess details
   */
  override getDetailedMessage(): string {
    return `Command: ${this.command}\n` +
      `WorkingDirectory: ${this.workingDirectory}\n` +
      `Subprocess Logs:\n\n` + this.subprocessLogs
  }
}

/**
 * Error class for Zod validation failures
 * 
 * @remarks
 * This error is thrown when Zod schema validation fails. It provides
 * detailed information about what validation rules were violated and
 * where the error occurred.
 * 
 * @example
 * ```typescript
 * try {
 *   const result = schema.parse(data);
 * } catch (error) {
 *   if (error instanceof ZodError) {
 *     throw new PanfactumZodError(
 *       'Invalid configuration',
 *       'config.yaml',
 *       error
 *     );
 *   }
 * }
 * ```
 */
export class PanfactumZodError extends CLIError {
  /** Location where the validation error occurred (e.g., file path) */
  location: string;
  /** The underlying Zod validation error */
  validationError: ZodError;
  /**
   * Creates a new PanfactumZodError instance
   * 
   * @param message - High-level error message
   * @param location - Where the validation error occurred (e.g., file path)
   * @param error - The Zod validation error with detailed issues
   */
  constructor(message: string, location: string, error: ZodError) {
    super(message);
    this.location = location;
    this.validationError = error;
  }

  /**
   * Gets detailed error message including all validation issues
   * 
   * @returns Formatted error message with validation details
   */
  override getDetailedMessage = (): string => {
    return `Location: ${this.location}\n` +
      `Validation Issues:\n\n` +
      this.validationError.issues.map(issue => `* ${issue.path.join(".")}: ${issue.message}`).join("\n")
  }
}