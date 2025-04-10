import { Command } from "clipanion";
import { buildKubeConfig } from "./buildKubeConfig";
import { buildSSHConfig } from "./buildSSHConfig";
import type { PanfactumContext } from "../../../context/context";

export class DevShellUpdateCommand extends Command<PanfactumContext> {
    static override paths = [["devshell", "update"]];

    static override usage = Command.Usage({
      description: "Updates the DevShell configuration",
      details:
        "Synchronizes the live infrastructure with configuration settings in your repository that control the DevShell's behavior.",
      examples: [["Update", "pf devshell update"]],
    });
  
    async execute(): Promise<number> {
        await buildKubeConfig({context: this.context})
        await buildSSHConfig({context: this.context})
        return 0
    }
}