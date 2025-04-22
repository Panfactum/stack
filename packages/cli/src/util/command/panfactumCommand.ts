import { Command, Option } from "clipanion";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";
import type { LogLevel } from "@/context/logger";

export abstract class PanfactumCommand extends Command<PanfactumContext> {

    logLevel: LogLevel = Option.String("--log-level,-v", "info", {
        env: "PF_LOG_LEVEL",
        description: "The verbosity of logging. Must be one of: debug, info, warn, error.",
        arity: 1
    });

    override async catch(error: unknown){

        if(error instanceof Error){
            this.context.logger.log(`${error.message}`, {level: "error"})

            // The detailed error message should always come from the error cause 
            // if there is no `cause` property, that means the `error` IS the cause
            // and not just a wrapper.
            const cause = error.cause || error 
            if(cause instanceof CLIError){
                this.context.logger.log(cause.getDetailedMessage(), {level: "error"})
            }

        } else {
            this.context.logger.log(JSON.stringify(error), {level: "error"})
        }
        this.context.logger.crashMessage()
        // TODO: @jack Add debug logs
    }
}
