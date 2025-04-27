import { Command, Option } from "clipanion";
import pc from "picocolors";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";

export abstract class PanfactumCommand extends Command<PanfactumContext> {

    debugEnabled: boolean | undefined = Option.Boolean("--debug", {
        description: "Activates debug logging",
    });

    override async catch(error: unknown) {
        if (error instanceof Error) {
            this.context.logger.error(error.constructor.name)
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
