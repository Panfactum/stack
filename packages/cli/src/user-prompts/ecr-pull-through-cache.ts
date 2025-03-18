import { input, password } from "@inquirer/prompts";
import { ensureFileExists } from "../util/ensure-file-exists";
import type { BaseContext } from "clipanion";

export async function ecrPullThroughCachePrompts({
  context,
}: {
  context: BaseContext;
}) {
  context.stdout.write(
    "To address issues with public image registry issues (rate limits, download sizes, service outages, etc.),\n" +
      "we will use a private image registry and a pull through cache.\n" +
      "This will allow us to cache images from public registries and pull them from our private registry.\n" +
      "Eventhough these are public registries, we will need to provide credentials for them.\n" +
      "For more information see our documentation:\n" +
      "https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#configure-pull-through-cache\n"
  );

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

  context.stdout.write("Encrypting secrets with SOPS...\n");

  const tempSecretsFilePath = "./.tmp-ecr-pull-through-cache-secrets.yaml";
  await Bun.write(
    tempSecretsFilePath,
    `github_access_token: ${githubPat}\ndocker_hub_access_token: ${dockerHubPat}`
  );

  const result = Bun.spawnSync(["sops", "encrypt", "-i", tempSecretsFilePath]);
  if (!result.success) {
    context.stderr.write(result.stderr.toString());
    const file = Bun.file(tempSecretsFilePath);
    await file.delete();
    throw new Error("Failed to encrypt ECR pull through cache secrets");
  }

  try {
    await ensureFileExists({
      context,
      destinationFile: "./aws_ecr_pull_through_cache/secrets.yaml",
      sourceFile: tempSecretsFilePath,
    });
  } finally {
    const file = Bun.file(tempSecretsFilePath);
    await file.delete();
  }

  return { githubUsername, dockerHubUsername };
}
