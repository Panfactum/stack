import { Command, Option } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";

export class VPCNetworkTestCommand extends PanfactumCommand {
  static override paths = [["aws", "vpc-network-test"]];

  // TODO: Optional
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
        "pf aws vpc-network-test --module-path <path-to-aws-vpc-module>",
      ],
    ],
  });

  async execute() {
    throw new CLIError("Command not implemented")

    // await vpcNetworkTest({
    // context: this.context,
    // modulePath: this.modulePath
    // });
  }
}
