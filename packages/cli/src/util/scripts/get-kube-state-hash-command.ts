import { Command, Option } from "clipanion";
import { getKubeStateHash } from "./get-kube-state-hash";

export class GetKubeStateHashCommand extends Command {
  static override paths = [["get-kube-state-hash"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description:
      "Returns a state hash used to determine if pf update-kube --build needs to be rerun.",
    details:
      "The hash is a combination of the update-kube script hash and the config.yaml file hash.",
    examples: [["Get kube state hash", "pf get-kube-state-hash"]],
  });
  async execute(): Promise<number> {
    let kubeStateHash;
    try {
      kubeStateHash = await getKubeStateHash({
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error getting kube state hash: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(JSON.stringify(error, null, 2));
      }
      return 1;
    }

    this.context.stdout.write(kubeStateHash + "\n");

    return 0;
  }
}
