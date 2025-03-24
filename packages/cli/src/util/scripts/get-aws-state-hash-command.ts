import { Command, Option } from "clipanion";
import { getAWSStateHash } from "./get-aws-state-hash";

export class GetAWSStateHashCommand extends Command {
  static override paths = [["get-aws-state-hash"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description:
      "Returns a state hash used to determine if pf update-aws --build needs to be rerun.",
    details:
      "The hash is a combination of the update-aws script hash and the config.yaml file hash.",
    examples: [["Get aws state hash", "pf get-aws-state-hash"]],
  });
  async execute(): Promise<number> {
    let awsStateHash;
    try {
      awsStateHash = await getAWSStateHash({
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error getting aws state hash: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(error);
      }
      return 1;
    }

    this.context.stdout.write(awsStateHash + "\n");

    return 0;
  }
}
