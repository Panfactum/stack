import { input, password } from "@inquirer/prompts";
import { $ } from "bun";
import pc from "picocolors";
import { ensureFileExists } from "../util/ensure-file-exists";
import type { BaseContext } from "clipanion";

export async function ecrPullThroughCachePrompts({
  context,
}: {
  context: BaseContext;
}) {
  context.stdout.write(
    pc.blue(
      "To address public image registry issues (rate limits, download sizes, service outages, etc...),\n" +
        "we will use a private image registry and a pull through cache.\n" +
        "This will allow us to cache images from public registries and pull them from our private registry.\n" +
        "Even though these are public registries, we will need to provide credentials for them.\n" +
        "For more information see our documentation:\n" +
        "https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#configure-pull-through-cache\n\n"
    )
  );

  // Prompt for GitHub PAT for Kubernetes Cluster
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#github-credentials
  const githubUsername = await input({
    message: pc.magenta("Enter your GitHub username:"),
    required: true,
  });

  const githubPat = await password({
    message: pc.magenta(
      `Enter your classic GitHub Personal Access Token with 'read:packages' scope\nFor more details on how to create one, see our documentation: https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#github-credentials\n${pc.red("this will be encrypted and stored securely")}:`
    ),
    mask: true,
    validate: async (value) => {
      const result =
        await $`curl -s -H "Authorization: Bearer ${value}" https://api.github.com/user/packages\?package_type\=container -w "%{http_code}" -o /dev/null`.text();
      if (result.trim().replace("%", "") !== "200") {
        return "This does not appear to be a valid GitHub Personal Access Token or the permissions are not correct";
      }
      return true;
    },
  });

  // Prompt for Docker Hub PAT for Kubernetes Cluster
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#docker-hub-credentials
  const dockerHubUsername = await input({
    message: pc.magenta("Enter your Docker Hub username:"),
    required: true,
  });

  const dockerHubPat = await password({
    message: pc.magenta(
      `Enter your Docker Hub Access Token with 'Public Repo Read-only' permissions\nFor more details on how to create one, see our documentation: https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#docker-hub-credentials\n${pc.red("this will be encrypted and stored securely")}:`
    ),
    mask: true,
    validate: async (value) => {
      const result =
        await $`curl -s -H "Authorization: Bearer ${value}" https://hub.docker.com/v2/repositories/library/nginx/tags -w "%{http_code}" -o /dev/null`.text();
      if (result.trim() !== "200") {
        return "This does not appear to be a valid Docker Hub Access Token or the permissions are not correct";
      }
      return true;
    },
  });

  context.stdout.write("\n2.a. 🔒 Encrypting secrets\n\n");

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
      sourceFile: await Bun.file(tempSecretsFilePath).text(),
    });
  } finally {
    const file = Bun.file(tempSecretsFilePath);
    await file.delete();
  }

  return { githubUsername, dockerHubUsername };
}
