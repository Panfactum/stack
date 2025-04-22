import {join} from "node:path"
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

export async function terragruntInit({
  context,
  environment,
  region,
  module,
  onLogLine
}: {
  context: PanfactumContext;
  environment: string;
  region: string;
  module: string;
  onLogLine?: (line: string) => void
}) {

  const workingDirectory = join(context.repoVariables.environments_dir, environment, region, module)

  // Step 1: Init the module and upgrade it's modules
  await execute({
    command: [
      "terragrunt",
      "init",
      "-upgrade",
      "-no-color",
      "--terragrunt-non-interactive",
      "--terragrunt-no-color"
    ],
    context,
    workingDirectory,
    errorMessage: "Failed to init infrastructure modules",
    onStdErrNewline: onLogLine,
    onStdOutNewline: onLogLine
  })

  // Step 2: Update the platform locks to include all platforms
  await execute({
    command: [
      "terragrunt",
      "providers",
      "lock",
      "-no-color",
      "-platform=linux_amd64",
      "-platform=linux_arm64",
      "-platform=darwin_amd64",
      "-platform=darwin_arm64",
      "--terragrunt-non-interactive",
      "--terragrunt-no-color"
    ],
    context,
    workingDirectory,
    errorMessage: "Failed to generate locks for module providers",
    onStdErrNewline: onLogLine,
    onStdOutNewline: onLogLine
  })
}
