import pc from "picocolors";

import type { BaseContext } from "clipanion";

/**
 * Initialize and upgrade Terraform modules using Terragrunt
 *
 * This function:
 * 1. Runs `terraform init -upgrade` on every module (installs new submodules and updates provider versions)
 * 2. Adds provider hashes to the .terraform.lock.hcl for every major platform
 *
 * @returns {boolean} Success status
 */
export function initTerraformModules(context: BaseContext): boolean {
  context.stdout.write(pc.black(pc.blue("Initializing and upgrading all Terraform modules...\n")));

  // Step 1: Run init -upgrade on all modules
  const initProcess = Bun.spawnSync(
    [
      "terragrunt",
      "run-all",
      "init",
      "-upgrade",
      "--terragrunt-ignore-external-dependencies",
    ],
    {
      stdout: "inherit",
      stderr: "inherit",
    }
  );

  // Check if the init process failed
  if (initProcess.exitCode !== 0) {
    context.stdout.write(pc.black(pc.red("Failed to initialize Terraform modules.\n")));
    return false;
  }

  context.stdout.write(pc.black(pc.blue("Updating platform locks for all platforms...\n")));

  // Step 2: Update the platform locks to include all platforms
  const lockProcess = Bun.spawnSync(
    [
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
    {
      stdout: "inherit",
      stderr: "inherit",
    }
  );

  // Check if the lock process failed
  if (lockProcess.exitCode !== 0) {
    context.stdout.write(pc.black(pc.red("Failed to update platform locks.\n")));
    return false;
  }

  context.stdout.write(pc.black(pc.green("Successfully initialized all Terraform modules!\n")));
  return true;
}
