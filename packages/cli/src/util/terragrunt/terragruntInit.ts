import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

export async function terragruntInit({
  context,
  workingDirectory = ".",
}: {
  context: PanfactumContext;
  workingDirectory?: string;
}) {

  // Step 1: Init the module and upgrade it's modules
  await execute({
    command: [
      "terragrunt",
      "run-all",
      "init",
      "-upgrade",
      "--terragrunt-ignore-external-dependencies",
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
    ],
    context,
    workingDirectory,
    errorMessage: "Failed to generate locks for module providers"
  })
}
