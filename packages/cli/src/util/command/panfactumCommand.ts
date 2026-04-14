// This file provides the base command class for all Panfactum CLI commands
// It extends Clipanion's Command class with common options and error handling

import { Command, Option } from "clipanion";
import pc from "picocolors";
import { Logger } from "@/util/context/logger";
import { CLIError } from "@/util/error/error";
import type { PanfactumContext, PanfactumBaseContext } from "@/util/context/context";

/**
 * Thrown after a command error has already been logged to signal that
 * the process should exit non-zero without printing another error message.
 *
 * @remarks
 * Clipanion's `run()` hardcodes exit code 0 when `Command.catch()` resolves
 * normally (`.then(() => 0)`). To produce a non-zero exit we must rethrow
 * from `catch()`. This sentinel class lets index.ts distinguish between
 * "already logged, just exit 1" and a genuinely unhandled error.
 *
 * @internal
 */
export class AlreadyLoggedError extends Error {
    constructor() {
        super('');
        this.name = 'AlreadyLoggedError';
    }
}

/**
 * Handles errors thrown during command execution
 *
 * @remarks
 * This function provides standardized error handling for all Panfactum commands:
 * 1. Displays the main error message
 * 2. Shows detailed error information if available (for CLIError instances)
 * 3. Prints the stack trace for debugging
 * 4. Shows a crash message to the user
 *
 * The function distinguishes between wrapper errors and their underlying causes,
 * ensuring the most relevant error information is displayed to the user.
 *
 * @param logger - The logger instance to use for error output
 * @param error - The error thrown during command execution
 *
 * @internal
 */
function handleCommandError(logger: Logger, error: unknown): void {
    if (error instanceof Error) {
        logger.error(error.message)

        // The detailed error message should always come from the error cause
        // if there is no `cause` property, that means the `error` IS the cause
        // and not just a wrapper.
        const cause = error.cause || error
        if (cause instanceof CLIError) {
            const details = cause.getDetailedMessage()
            if (details) {
                logger.error("Details ==========================================================")
                logger.writeRaw(pc.red(details))
            }

        }

        const stack = cause instanceof Error ? cause.stack ?? error.stack : error.stack
        if (stack) {
            logger.error("Stack Trace ==========================================================")
            logger.writeRaw(pc.red(stack))
        }

    } else {
        logger.writeRaw(pc.red(JSON.stringify(error, undefined, 4)))
    }

    logger.crashMessage()
    // TODO: @jack Add debug logs
}

/**
 * Lightweight base class for Panfactum CLI commands that don't require devshell configuration
 *
 * @remarks
 * This abstract class extends Clipanion's Command class to provide:
 * - Common command-line options (--debug, --cwd) available to all commands
 * - Standardized error handling with detailed error messages and stack traces
 * - Integration with the lightweight Panfactum base context and logging system
 *
 * This class provides {@link PanfactumBaseContext} without `devshellConfig`, making it
 * suitable for commands that run in CI/CD containers without a git repository. Commands
 * that need access to devshell configuration should extend {@link PanfactumCommand} instead.
 *
 * @example
 * ```typescript
 * export class MyLightCommand extends PanfactumLightCommand {
 *   static paths = [["my", "light-command"]];
 *
 *   async execute() {
 *     this.context.logger.info("Executing my light command");
 *     if (this.debugEnabled) {
 *       this.context.logger.debug("Debug mode is enabled");
 *     }
 *   }
 * }
 * ```
 *
 * @see {@link Command} - Base Clipanion Command class
 * @see {@link PanfactumBaseContext} - Base context object passed to light commands
 * @see {@link PanfactumCommand} - Full command class with devshell configuration
 */
export abstract class PanfactumLightCommand extends Command<PanfactumBaseContext> {
    /**
     * Debug mode flag that enables verbose logging
     *
     * @remarks
     * When set to true via the --debug flag, commands should output
     * additional diagnostic information to help with troubleshooting.
     */
    debugEnabled: boolean | undefined = Option.Boolean("--debug", {
        description: "Activates debug logging",
    });

    /**
     * Working directory override for command execution
     *
     * @remarks
     * Allows users to specify a different working directory for the command.
     * If not specified, the command uses the current working directory.
     *
     * @todo Change to repo dir
     */
    cwd: string | undefined = Option.String("--cwd", {
        description: "The working directory to use",
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    override async catch(error: unknown) {
        handleCommandError(this.context.logger, error);
        throw new AlreadyLoggedError();
    }
}

/**
 * Base class for all Panfactum CLI commands that require devshell configuration
 *
 * @remarks
 * This abstract class extends Clipanion's Command class to provide:
 * - Common command-line options (--debug, --cwd) available to all commands
 * - Standardized error handling with detailed error messages and stack traces
 * - Integration with the full Panfactum context and logging system
 *
 * This class provides {@link PanfactumContext} with `devshellConfig` loaded from the
 * filesystem. Commands that don't need devshell configuration can extend the lighter
 * {@link PanfactumLightCommand} instead.
 *
 * All standard Panfactum commands should extend this class rather than the base
 * Clipanion Command class to ensure consistent behavior across the CLI.
 *
 * @example
 * ```typescript
 * export class MyCommand extends PanfactumCommand {
 *   static paths = [["my", "command"]];
 *
 *   async execute() {
 *     this.context.logger.info("Executing my command");
 *     if (this.debugEnabled) {
 *       this.context.logger.debug("Debug mode is enabled");
 *     }
 *     // Access devshell config
 *     const config = this.context.devshellConfig;
 *   }
 * }
 * ```
 *
 * @see {@link Command} - Base Clipanion Command class
 * @see {@link PanfactumContext} - Context object passed to all commands
 * @see {@link PanfactumLightCommand} - Lightweight command class without devshell config
 */
export abstract class PanfactumCommand extends Command<PanfactumContext> {

    /**
     * Debug mode flag that enables verbose logging
     * 
     * @remarks
     * When set to true via the --debug flag, commands should output
     * additional diagnostic information to help with troubleshooting.
     */
    debugEnabled: boolean | undefined = Option.Boolean("--debug", {
        description: "Activates debug logging",
    });

    /**
     * Working directory override for command execution
     * 
     * @remarks
     * Allows users to specify a different working directory for the command.
     * If not specified, the command uses the current working directory.
     * 
     * @todo Change to repo dir
     */
    cwd: string | undefined = Option.String("--cwd", {
        description: "The working directory to use",
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    override async catch(error: unknown) {
        handleCommandError(this.context.logger, error);
        throw new AlreadyLoggedError();
    }
}
