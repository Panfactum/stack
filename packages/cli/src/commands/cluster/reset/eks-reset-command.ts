import { Command, Option } from "clipanion";
import { eksReset } from "./clusterReset";

export class EksResetCommand extends Command {
  static override paths = [["eks-reset"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description: "Resets the EKS cluster configuration.",
    details:
      "This command resets the EKS cluster by removing all resources and preparing it for a fresh deployment of Kubernetes modules.",
    examples: [["Reset EKS cluster", "pf eks-reset"]],
  });

  async execute(): Promise<number> {
    try {
      await eksReset({
        commandInvocation: true,
        context: this.context,
        verbose: this.verbose,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error resetting EKS cluster: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(JSON.stringify(error, null, 2));
      }
      return 1;
    }

    return 0;
  }
}
