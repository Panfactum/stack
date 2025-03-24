import { Command, Option } from "clipanion";
import { updateSSH } from "./update-ssh";

export class UpdateSSHCommand extends Command {
  static override paths = [["update-ssh"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  build = Option.Boolean("-b,--build", {
    description: "Build the ssh config",
  });

  static override usage = Command.Usage({
    description: "Updates the ssh config.",
    details: "Adds the standard .ssh configuration files.",
    examples: [["Update ssh config", "pf update-ssh"]],
  });
  async execute(): Promise<number> {
    try {
      await updateSSH({
        buildKnownHosts: this.build,
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error updating ssh config: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(JSON.stringify(error, null, 2));
      }
      return 1;
    }

    return 0;
  }
}
