import { Command, Option } from "clipanion";
import { updateKube } from "./update-kube";

export class UpdateKubeCommand extends Command {
  static override paths = [["update-kube"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  build = Option.Boolean("-b,--build", {
    description: "Build the kube config",
  });

  static override usage = Command.Usage({
    description: "Updates the kube config.",
    details: "Adds the standard kube configuration files.",
    examples: [["Update kube config", "pf update-kube"]],
  });
  async execute(): Promise<number> {
    try {
      await updateKube({
        buildConfig: this.build,
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error updating kube config: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(error);
      }
      return 1;
    }

    return 0;
  }
}
