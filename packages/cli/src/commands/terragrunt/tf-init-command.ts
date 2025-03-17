import { Command, Option } from "clipanion";
import { initModules } from "./init-modules";

export class TerragruntInitCommand extends Command {
  static override paths = [["tf-init"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description:
      "Initialize and upgrade all infrastructure modules, and update platform locks",
    details:
      "This command performs two operations:\n\n" +
      "1. Runs terragrunt init -upgrade on every module\n\n" +
      "2. Adds provider hashes to the .terraform.lock.hcl for all major platforms",
    examples: [["Initialize all infrastructure modules", "pf tf-init"]],
  });
  async execute(): Promise<number> {
    return initModules({ context: this.context, verbose: this.verbose });
  }
}
