import { Command, Option } from "clipanion";
import { getBuildkitUserStateHash } from "./get-buildkit-user-state-hash";

export class GetBuildkitUserStateHashCommand extends Command {
  static override paths = [["get-buildkit-user-state-hash"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description:
      "Returns a state hash used to determine if pf update-buildkit needs to be rerun.",
    details:
      "The hash is a combination of the update-buildkit script hash and the config.yaml file hash.",
    examples: [
      ["Get buildkit user state hash", "pf get-buildkit-user-state-hash"],
    ],
  });
  async execute(): Promise<number> {
    let buildkitUserStateHash;
    try {
      buildkitUserStateHash = await getBuildkitUserStateHash({
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error getting buildkit user state hash: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(JSON.stringify(error, null, 2));
      }
      return 1;
    }

    this.context.stdout.write(buildkitUserStateHash + "\n");

    return 0;
  }
}
