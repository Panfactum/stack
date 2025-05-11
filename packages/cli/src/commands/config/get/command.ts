import { resolve } from "node:path";
import { Command, Option } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";
import { getPanfactumConfig } from "../../../util/config/getPanfactumConfig";

export class ConfigGetCommand extends PanfactumCommand {
    static override paths = [["config", "get"]];

    static override usage = Command.Usage({
        description: "Gets the Panfactum configuration",
        details:
            "Returns the Panfactum configuration",
    });

    directory: string | undefined = Option.String("--directory,-d", {
        description: "Get the configuration of this directory (instead of the CWD)",
        arity: 1,
    });

    async execute() {
        const directory = this.directory ? resolve(this.directory) : process.cwd()

        if (!directory.startsWith(this.context.repoVariables.repo_root)) {
            throw new CLIError(`Provided directory ${directory} is not inside the repository.`)
        }

        const mergedConfig = {
            ...await getPanfactumConfig({ context: this.context, directory }),
            ...this.context.repoVariables
        }
        this.context.stdout.write(JSON.stringify(mergedConfig, undefined, 4))
        return 0
    }
}


