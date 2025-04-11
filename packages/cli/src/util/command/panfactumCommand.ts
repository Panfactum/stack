import { Command } from "clipanion";
import { CLIError, CLISubprocessError, PanfactumZodError } from "../error/error";
import type { PanfactumContext } from "@/context/context";

export abstract class PanfactumCommand extends Command<PanfactumContext> {

    override async catch(error: unknown){
        if(error instanceof PanfactumZodError){
            this.context.logger.log(`${error.message}`, {level: "error"})
            const zodError = error.validationError;
            this.context.logger.log(
                `Location: ${error.location}
                Validation Issues:
                
                ${zodError.issues.map(issue => `* ${issue.path.join(".")}: ${issue.message}`).join("\n")}
                `,
                {
                    leadingNewlines: 1,
                    level: "error"
                }
            )
        }else if(error instanceof CLIError){
            this.context.logger.log(`${error.message}`, {level: "error"})

            const {cause} = error;
            if(cause instanceof CLISubprocessError){
                this.context.logger.log(
                    `Command: ${cause.command}
                    WorkingDirectory: ${cause.workingDirectory}
                    Subprocess Logs:
                    
                    ${cause.subprocessLogs}
                    `,
                    {
                        leadingNewlines: 1,
                        level: "error"
                    }
                )
            }
        }else if(error instanceof Error){
            this.context.logger.log(`${error.message}`, {level: "error"})
        } else {
            this.context.logger.log(JSON.stringify(error), {level: "error"})
        }
        this.context.logger.crashMessage()
        // TODO: @jack Add debug logs
    }
}
