import { Command, Option } from "clipanion";
import { getKubeUserStateHash } from "./get-kube-user-state-hash";

export class GetKubeUserStateHashCommand extends Command {
  static override paths = [["get-kube-user-state-hash"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description: "Returns a state hash for the kube user.",
    details:
      "Returns a state hash used to determine if pf update-kube needs to be rerun.",
    examples: [["Get kube user state hash", "pf get-kube-user-state-hash"]],
  });

  async execute(): Promise<number> {
    let hash;
    try {
      hash = await getKubeUserStateHash({
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error getting kube user state hash: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(JSON.stringify(error, null, 2));
      }
      return 1;
    }

    this.context.stdout.write(hash + "\n");

    return 0;
  }
}
