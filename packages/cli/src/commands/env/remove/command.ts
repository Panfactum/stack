import { Command } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";

export class EnvironmentRemoveCommand extends PanfactumCommand {
    static override paths = [["env", "remove"]];

    static override usage = Command.Usage({
        description: "Destroys an environment and all infrastructure contained in it",
        category: 'Environment',
    });

    async execute() {
        this.context.logger.warn(`
            This command is not yet implemented.

            However, the DevShell comes with 'aws-nuke' which can be used
            to delete all AWS resources.
        `)
        throw new CLIError("Command not implemented.")
    }
}