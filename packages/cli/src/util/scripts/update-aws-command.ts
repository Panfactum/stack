import { Command, Option } from "clipanion";
import { updateAWS } from "./update-aws";

export class UpdateAWSCommand extends Command {
  static override paths = [["update-aws"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  build = Option.Boolean("-b,--build", {
    description: "Build the AWS config",
  });

  static override usage = Command.Usage({
    description: "Updates the aws config.",
    details: "Adds the standard .aws configuration files.",
    examples: [["Update aws config", "pf update-aws"]],
  });
  async execute(): Promise<number> {
    try {
      await updateAWS({
        buildAwsConfig: this.build,
        context: this.context,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error updating aws config: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(JSON.stringify(error, null, 2));
      }
      return 1;
    }

    return 0;
  }
}
