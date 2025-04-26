import { Command, Option } from "clipanion";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";
import type { LogLevel } from "@/context/logger";

export abstract class PanfactumCommand extends Command<PanfactumContext> {

    debugEnabled: LogLevel = Option.Boolean("--debug", {
        description: "Activates debug logging",
    });

    override async catch(error: unknown) {
        if (error instanceof Error) {
            this.context.logger.error(error.message)

            // The detailed error message should always come from the error cause 
            // if there is no `cause` property, that means the `error` IS the cause
            // and not just a wrapper.
            const cause = error.cause || error
            if (cause instanceof CLIError) {
                this.context.logger.error(cause.getDetailedMessage())
            }

        } else {
            this.context.logger.error(JSON.stringify(error))
        }
        this.context.logger.crashMessage()
        // TODO: @jack Add debug logs
    }
}
