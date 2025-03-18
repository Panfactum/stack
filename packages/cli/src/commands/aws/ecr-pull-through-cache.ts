import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { tfInit } from "../../util/scripts/tf-init";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

export interface EcrPullThroughCacheSetupInput {
  context: BaseContext;
  verbose?: boolean;
  dockerHubUsername: string;
  githubUsername: string;
}

export async function setupEcrPullThroughCache(
  input: EcrPullThroughCacheSetupInput
) {
  await ensureFileExists({
    context: input.context,
    destinationFile: "./aws_ecr_pull_through_cache/terragrunt.hcl",
    sourceFile: await Bun.file(
      import.meta.dir + "/templates/aws_ecr_pull_through_cache_terragrunt.hcl"
    ).text(),
  });

  await replaceHclValue(
    "./aws_ecr_pull_through_cache/terragrunt.hcl",
    "docker_hub_username",
    input.dockerHubUsername
  );

  await replaceHclValue(
    "./aws_ecr_pull_through_cache/terragrunt.hcl",
    "github_username",
    input.githubUsername
  );

  tfInit({
    context: input.context,
    verbose: input.verbose,
    workingDirectory: "./aws_ecr_pull_through_cache",
  });

  apply({
    context: input.context,
    verbose: input.verbose,
    workingDirectory: "./aws_ecr_pull_through_cache",
  });
}
