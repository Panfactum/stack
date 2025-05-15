import {Command} from "clipanion";
import {PanfactumCommand} from "@/util/command/panfactumCommand.ts";

import {CLIError} from "@/util/error/error.ts";

export class ClusterEnableCommand extends PanfactumCommand {
  static override paths = [["cluster", "enable"]];

  static override usage = Command.Usage({
    description: "Enable Cluster Features",
    details:
      "This command adds and enables features for a cluster. This is typically used to enable features that are not enabled by default.",
    examples: [["Enable ECR pull-through cache", "pf cluster enable ecr-pull-through-cache"]],
  });

  async execute() {
    // todo: implement input and trigger on selection
    this.context.logger.warn(`
            This command is not yet implemented.
        `)
    throw new CLIError("Command not implemented.")

  }
}