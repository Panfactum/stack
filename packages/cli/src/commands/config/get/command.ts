import { Command } from "clipanion";
import type { PanfactumContext } from "../../../context";
import { getPanfactumConfig } from "./getPanfactumConfig";

export class ConfigGetCommand extends Command<PanfactumContext> {
    static override paths = [["config", "get"]];

    static override usage = Command.Usage({
      description: "Gets the Panfactum configuration",
      details:
        "Returns the Panfactum configuration",
    });
  
    async execute(): Promise<number> {
        this.context.stdout.write(JSON.stringify(await getPanfactumConfig({context: this.context})))
        return 0
    }
}


