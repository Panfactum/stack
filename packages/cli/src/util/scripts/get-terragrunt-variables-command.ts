import { Command, Option } from "clipanion";
import { getTerragruntVariables } from "./get-terragrunt-variables";

export class GetTerragruntVariablesCommand extends Command {
  static override paths = [["get-terragrunt-variables"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description:
      "Returns a JSON object containing the Terragrunt variables that Terragrunt would use if it were run in the given directory.",
    details:
      "Terragrunt variables are the Panfactum-specific configuration settings defined here:\n\n" +
      "https://panfactum.com/docs/edge/reference/configuration/terragrunt-variables.",
    examples: [["Get Terragrunt variables", "pf get-terragrunt-variables"]],
  });
  async execute(): Promise<number> {
    let terragruntVariables;
    try {
      terragruntVariables = await getTerragruntVariables({
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error getting Terragrunt variables: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(JSON.stringify(error, null, 2));
      }
      return 1;
    }

    this.context.stdout.write(
      `# Terragrunt variables\n\n${JSON.stringify(terragruntVariables, null, 2)}\n`
    );

    return 0;
  }
}
