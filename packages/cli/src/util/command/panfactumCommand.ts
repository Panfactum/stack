// This file provides the base command class for all Panfactum CLI commands
// It extends Clipanion's Command class with common options and error handling

import { Command, Option } from "clipanion";
import pc from "picocolors";
import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Base class for all Panfactum CLI commands
 * 
 * @remarks
 * This abstract class extends Clipanion's Command class to provide:
 * - Common command-line options (--debug, --cwd) available to all commands
 * - Standardized error handling with detailed error messages and stack traces
 * - Integration with the Panfactum context and logging system
 * 
 * All Panfactum commands should extend this class rather than the base
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
 *   }
 * }
 * ```
 * 
 * @see {@link Command} - Base Clipanion Command class
 * @see {@link PanfactumContext} - Context object passed to all commands
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

    /**
     * Handles errors thrown during command execution
     * 
     * @remarks
     * This method provides standardized error handling for all Panfactum commands:
     * 1. Displays the main error message
     * 2. Shows detailed error information if available (for CLIError instances)
     * 3. Prints the stack trace for debugging
     * 4. Shows a crash message to the user
     * 
     * The method distinguishes between wrapper errors and their underlying causes,
     * ensuring the most relevant error information is displayed to the user.
     * 
     * @param error - The error thrown during command execution
     * 
     * @internal
     * @override
     */
    override async catch(error: unknown) {
        if (error instanceof Error) {
            this.context.logger.error(error.message)

            // The detailed error message should always come from the error cause 
            // if there is no `cause` property, that means the `error` IS the cause
            // and not just a wrapper.
            const cause = error.cause || error
            if (cause instanceof CLIError) {
                const details = cause.getDetailedMessage()
                if (details) {
                    this.context.logger.error("Details ==========================================================")
                    this.context.logger.writeRaw(pc.red(details))
                }

            }

            const stack = cause instanceof Error ? cause.stack ?? error.stack : error.stack
            if (stack) {
                this.context.logger.error("Stack Trace ==========================================================")
                this.context.logger.writeRaw(pc.red(stack))
            }

        } else {
            this.context.logger.writeRaw(pc.red(JSON.stringify(error, undefined, 4)))
        }

        this.context.logger.crashMessage()
        // TODO: @jack Add debug logs
    }
}
