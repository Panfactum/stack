import { Command, Option } from "clipanion";
import { updateBuildkit } from "./update-buildkit";

export class UpdateBuildkitCommand extends Command {
  static override paths = [["update-buildkit"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  build = Option.Boolean("-b,--build", {
    description: "Build the buildkit config",
  });

  static override usage = Command.Usage({
    description: "Updates the buildkit config.",
    details: "Adds the standard buildkit configuration files.",
    examples: [["Update buildkit config", "pf update-buildkit"]],
  });
  async execute(): Promise<number> {
    try {
      await updateBuildkit({
        buildConfig: this.build,
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error updating buildkit config: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(error);
      }
      return 1;
    }

    return 0;
  }
}
