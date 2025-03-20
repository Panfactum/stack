import { Command, Option } from "clipanion";
import { getSSHStateHash } from "./get-ssh-state-hash";

export class GetSSHStateHashCommand extends Command {
  static override paths = [["get-ssh-state-hash"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description: "Returns a state hash for the ssh config.",
    details:
      "Returns a state hash used to determine if pf update-ssh needs to be rerun.",
    examples: [["Get ssh state hash", "pf get-ssh-state-hash"]],
  });
  async execute(): Promise<number> {
    let hash;
    try {
      hash = await getSSHStateHash({
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error getting ssh state hash: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(error);
      }
      return 1;
    }

    this.context.stdout.write(hash);

    return 0;
  }
}
