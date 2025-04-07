import ecrPullThroughCacheTemplate from "../../../../templates/aws_ecr_pull_through_cache_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../../../util/ensure-file-exists";
import { initAndApplyModule } from "../../../../util/init-and-apply-module";
import { replaceHclValue } from "../../../../util/replace-hcl-value";
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

  input.context.stdout.write("2.a. Setting up infrastructure as code\n");

  await initAndApplyModule({
    context: input.context,
    moduleName: "ECR Pull Through Cache",
    modulePath: "./aws_ecr_pull_through_cache",
    verbose: input.verbose,
  });
}
