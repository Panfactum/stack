import { confirm, input, password, select } from "@inquirer/prompts";
import type { BaseContext } from "clipanion";

export async function userQAndA({
  context,
  environment,
  needSlaTarget,
}: {
  context: BaseContext;
  environment: string;
  needSlaTarget: boolean;
}) {
  // https://panfactum.com/docs/edge/guides/bootstrapping/aws-networking#choose-your-sla-target
  let slaTarget: 1 | 2 | 3 | undefined;
  if (needSlaTarget) {
    slaTarget = await select({
      message:
        "Select your SLA target (affects high availability configuration). We recommend level 1 for test / development environments and level 2 or above for environments running live workloads.",
      choices: [
        {
          name: "Level 1: 99.9% uptime (< 45 minutes of downtime / month) — Lowest cost",
          value: 1,
        },
        {
          name: "Level 2: 99.99% uptime (< 5 minutes of downtime / month) — Roughly 2x the cost of level 1",
          value: 2,
        },
        {
          name: "Level 3: 99.999% uptime (< 30 seconds of downtime / month) — Roughly 1.5x the cost of level 2",
          value: 3,
        },
      ],
      default: 3,
    });

    // Warn about SLA target being difficult to change
    context.stdout.write(
      "\n\u26A0\uFE0F WARNING: SLA target affects your network architecture and is not easily changed later.\n"
    );
    context.stdout.write(
      "This determines how many availability zones your infrastructure will span.\n"
    );

    const proceed = await confirm({
      message: "Do you want to proceed with the installation?",
      default: true,
    });

    if (proceed === false) {
      context.stdout.write("Installation cancelled.\n");
      return 0;
    }
  }

  // VPC information https://panfactum.com/docs/edge/guides/bootstrapping/aws-networking#deploy-the-aws-vpc-module
  // Prompt for VPC name
  const vpcName = await input({
    message: "Enter a name for your VPC:",
    default: `panfactum-${environment}`,
  });

  // Prompt for VPC description
  const vpcDescription = await input({
    message: "Enter a description for your VPC:",
    default: `Panfactum VPC for the ${environment} environment`,
  });

  // Prompt for GitHub PAT for Kubernetes Cluster
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#github-credentials
  const githubUsername = await input({
    message: "Enter your GitHub username:",
    required: true,
  });

  const githubPat = await password({
    message:
      "Enter your classic GitHub Personal Access Token with 'read:packages' scope (this will be encrypted with SOPS and stored securely):",
    mask: true,
  });

  // Prompt for Docker Hub PAT for Kubernetes Cluster
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#docker-hub-credentials
  const dockerHubUsername = await input({
    message: "Enter your Docker Hub username:",
    required: true,
  });

  const dockerHubPat = await password({
    message:
      "Enter your Docker Hub Access Token with 'Public Repo Read-only' permissions (this will be encrypted with SOPS and stored securely):",
    mask: true,
  });

  // Prompt for cluster info
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#choose-a-cluster-name
  const clusterName = await input({
    message: "Enter a name for your Kubernetes cluster:",
    default: `panfactum-${environment}`,
  });

  const clusterDescription = await input({
    message: "Enter a description for your Kubernetes cluster:",
    default: `Panfactum Kubernetes cluster for the ${environment} environment`,
  });

  return {
    clusterDescription,
    clusterName,
    dockerHubPat,
    dockerHubUsername,
    githubPat,
    githubUsername,
    slaTarget,
    vpcName,
    vpcDescription,
  };
}
