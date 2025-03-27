import { Command, Option } from "clipanion";
import { getBuildkitStateHash } from "./get-buildkit-state-hash";

export class GetBuildkitStateHashCommand extends Command {
  static override paths = [["get-buildkit-state-hash"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description:
      "Returns a state hash used to determine if pf update-buildkit --build needs to be rerun.",
    details:
      "The hash is a combination of the update-buildkit script hash and the config.yaml file hash.",
    examples: [["Get buildkit state hash", "pf get-buildkit-state-hash"]],
  });
  async execute(): Promise<number> {
    let buildkitStateHash;
    try {
      buildkitStateHash = await getBuildkitStateHash({
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error getting buildkit state hash: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(JSON.stringify(error, null, 2));
      }
      return 1;
    }

    this.context.stdout.write(buildkitStateHash + "\n");

    return 0;
  }
}
