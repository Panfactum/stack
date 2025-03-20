import { Command, Option } from "clipanion";
import { checkRepoSetup } from "./check-repo-setup";

export class CheckRepoSetupCommand extends Command {
  static override paths = [["check-repo-setup"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description: "Checks the repo setup.",
    details:
      "There are many setup steps that are required to ensure that users of the Panfactum stack have a smooth experience. This utility function should be run every time the devenv gets launched in order to ensure that the setup steps have been completed properly.",
    examples: [["Check repo setup", "pf check-repo-setup"]],
  });
  async execute(): Promise<number> {
    try {
      await checkRepoSetup({
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error checking repo setup: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(error);
      }
      return 1;
    }

    return 0;
  }
}
