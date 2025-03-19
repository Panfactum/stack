import { Command, Option } from "clipanion";
import { getKubeToken } from "./get-kube-token";

export class GetKubeTokenCommand extends Command {
  static override paths = [["get-kube-token"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  region = Option.String("-r,--region", {
    required: true,
    description: "The AWS region of the EKS cluster",
  });

  clusterName = Option.String("-c,--cluster-name", {
    required: true,
    description: "The name of the EKS cluster",
  });

  awsProfile = Option.String("-p,--profile", {
    required: true,
    description: "The AWS profile to use for authentication",
  });

  static override usage = Command.Usage({
    description: "Returns a kube token for the given cluster.",
    details:
      "A thin wrapper over the AWS CLI to get a kube token for the given cluster.",
    examples: [
      [
        "Get kube token",
        "pf get-kube-token --region us-east-1 --cluster-name my-cluster --profile my-profile",
      ],
    ],
  });
  async execute(): Promise<number> {
    let token;
    try {
      token = await getKubeToken({
        awsProfile: this.awsProfile,
        clusterName: this.clusterName,
        context: this.context,
        region: this.region,
      });
    } catch (error: unknown) {
      this.context.stderr.write(
        `Error getting kube token: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (this.verbose) {
        this.context.stderr.write(error);
      }
      return 1;
    }

    this.context.stdout.write(token);

    return 0;
  }
}
