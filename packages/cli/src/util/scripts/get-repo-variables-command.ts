import { Command, Option } from "clipanion";
import { getRepoVariables } from "./get-repo-variables";

export class GetRepoVariablesCommand extends Command {
  static override paths = [["get-repo-variables"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description:
      "Returns repository variables as a JSON payload so that they can be referenced in other scripts",
    details:
      "It also performs the following mutations:\n\n" +
      "1. Adds default values\n\n" +
      "2. Resolves _dir variables to their absolute path on the local system\n\n" +
      "3. Adds the repo_root variable\n\n" +
      "4. Adds the iac_dir_from_root variable which is the original value of iac_dir before being resolved to an absolute path",
    examples: [["Get repository variables", "pf get-repo-variables"]],
  });
  async execute(): Promise<number> {
    let repoVariables;
    try {
      repoVariables = await getRepoVariables({
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error getting repository variables: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(JSON.stringify(error, null, 2));
      }
      return 1;
    }

    this.context.stdout.write(JSON.stringify(repoVariables, null, 2) + "\n");

    return 0;
  }
}
