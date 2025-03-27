import ecrPullThroughCacheTemplate from "../../templates/aws_ecr_pull_through_cache_terragrunt.hcl" with { type: "file" };
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
    sourceFile: await Bun.file(ecrPullThroughCacheTemplate).text(),
  });

  await replaceHclValue(
    "./aws_ecr_pull_through_cache/terragrunt.hcl",
    "inputs.docker_hub_username",
    input.dockerHubUsername
  );

  await replaceHclValue(
    "./aws_ecr_pull_through_cache/terragrunt.hcl",
    "inputs.github_username",
    input.githubUsername
  );

  input.context.stdout.write("2.b. Setting up infrastructure as code\n");

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
