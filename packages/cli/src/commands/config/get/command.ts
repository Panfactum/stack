import { Command } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { getPanfactumConfig } from "./getPanfactumConfig";

export class ConfigGetCommand extends PanfactumCommand {
    static override paths = [["config", "get"]];

    static override usage = Command.Usage({
        description: "Gets the Panfactum configuration",
        details:
            "Returns the Panfactum configuration",
    });

    async execute() {
        const mergedConfig = {
            ...await getPanfactumConfig({ context: this.context }),
            ...this.context.repoVariables
        }
        this.context.stdout.write(JSON.stringify(mergedConfig, undefined, 4))
        return 0
    }
}


