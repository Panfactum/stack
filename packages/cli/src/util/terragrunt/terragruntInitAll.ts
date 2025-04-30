import { join } from "node:path"
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

export async function terragruntInitAll({
  context,
  environment,
  region
}: {
  context: PanfactumContext;
  environment: string;
  region?: string;
}) {

  const workingDirectory = join(context.repoVariables.environments_dir, environment, region ?? "")


  // Step 1: Init the module and upgrade it's modules
  await execute({
    command: [
      "terragrunt",
      "run-all",
      "init",
      "-upgrade",
      "--terragrunt-ignore-external-dependencies",
      "--terragrunt-non-interactive"
    ],
    context,
    workingDirectory,
    errorMessage: "Failed to init infrastructure modules"
  })

  // Step 2: Update the platform locks to include all platforms
  await execute({
    command: [
      "terragrunt",
      "run-all",
      "providers",
      "lock",
      "-platform=linux_amd64",
      "-platform=linux_arm64",
      "-platform=darwin_amd64",
      "-platform=darwin_arm64",
      "--terragrunt-ignore-external-dependencies",
      "--terragrunt-non-interactive"
    ],
    context,
    workingDirectory,
    errorMessage: "Failed to generate locks for module providers"
  })
}
