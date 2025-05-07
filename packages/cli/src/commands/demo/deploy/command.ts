import { Command } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";

export class DemoCommand extends PanfactumCommand {
  static override paths = [["demo", "deploy"]];

  static override usage = Command.Usage({
    description: "Deploys Panfactum Demo Application",
    details:
      "xxx",
  });

  async execute() {

    return 0
  }
}


