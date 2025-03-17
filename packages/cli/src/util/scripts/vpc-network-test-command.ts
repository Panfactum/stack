import { Command, Option } from "clipanion";
import { vpcNetworkTest } from "./vpc-network-test";

export class VpcNetworkTestCommand extends Command {
  static override paths = [["vpc-network-test"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  modulePath = Option.String("--module-path", {
    description: "The path to the aws_vpc module",
    required: true,
  });

  static override usage = Command.Usage({
    description: "To ensure connectivity after deploying the aws_vpc modules",
    details:
      "This command is intended to test to ensure connectivity after deploying the aws_vpc modules",
    examples: [
      [
        "Test VPC network connectivity",
        "pf vpc-network-test --module-path <path-to-aws-vpc-module>",
      ],
    ],
  });
  async execute(): Promise<number> {
    try {
      await vpcNetworkTest({
        context: this.context,
        modulePath: this.modulePath,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error testing VPC network connectivity: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(error);
      }
      return 1;
    }

    return 0;
  }
}
