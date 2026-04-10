// This file provides utilities for initializing all Terragrunt modules in an environment or region
// It runs terragrunt init --all to initialize all modules in parallel

import { join } from "node:path"
import { CLISubprocessError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for initializing all Terragrunt modules
 */
interface ITerragruntInitAllInput {
  /** Panfactum context for configuration */
  context: PanfactumContext;
  /** Name of the environment */
  environment: string;
  /** Name of the region (optional - if omitted, initializes entire environment) */
  region?: string;
  /** Module directories to scope initialization to (optional - if omitted, initializes all modules) */
  modules?: string[];
}

/**
 * Initializes all Terragrunt modules in an environment or region
 *
 * @remarks
 * This function uses `terragrunt init --all` to initialize multiple modules
 * in parallel. It's designed for bulk initialization scenarios where all
 * modules in a directory tree need to be prepared for deployment.
 *
 * The initialization process:
 *
 * 1. **Parallel Initialization**: Runs `terragrunt init --all -upgrade` to:
 *    - Initialize all modules in the directory tree (or specified subset)
 *    - Download required Terraform providers for each module
 *    - Set up backend configurations
 *    - Upgrade to latest provider versions
 *    - Respect module dependencies but ignore external ones
 *
 * 2. **Provider Lock Generation**: Runs `terragrunt run --all -- providers lock` to:
 *    - Generate provider checksums for all platforms
 *    - Create .terraform.lock.hcl files for each module
 *    - Support Linux (amd64/arm64) and macOS (amd64/arm64)
 *    - Ensure consistent provider versions across all modules
 *
 * Key behaviors:
 * - If region is provided: initializes all modules in that region
 * - If region is omitted: initializes all modules in the entire environment
 * - If modules is provided: scopes initialization to only the specified module directories
 * - If modules is omitted: initializes all modules in the directory tree
 * - Uses `--queue-exclude-external` to skip modules outside the tree
 * - Uses `--queue-strict-include` when modules are specified to ensure only those directories are processed
 * - Runs non-interactively to prevent prompts
 * - Processes modules in parallel for performance
 *
 * Common use cases:
 * - Setting up a new environment for the first time
 * - Preparing all modules after provider updates
 * - Bulk initialization after cloning a repository
 * - CI/CD pipeline initialization steps
 * - Scoped initialization of specific modules to avoid provider cache conflicts
 *
 * @param input - Configuration for the bulk initialization
 *
 * @example
 * ```typescript
 * // Initialize all modules in a specific region
 * await terragruntInitAll({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1'
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Initialize all modules in entire environment
 * await terragruntInitAll({
 *   context,
 *   environment: 'staging'
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Initialize only specific modules to avoid provider cache conflicts
 * await terragruntInitAll({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
 *   modules: ['kube_bastion', 'kube_keda']
 * });
 * ```
 *
 * @throws {@link CLISubprocessError}
 * Throws when terragrunt init --all fails
 *
 * @throws {@link CLISubprocessError}
 * Throws when provider lock generation fails
 *
 * @see {@link terragruntInit} - For initializing individual modules
 * @see {@link terragruntApplyAll} - For deploying after initialization
 * @see {@link execute} - For subprocess execution details
 */
export async function terragruntInitAll(input: ITerragruntInitAllInput) {
  const { context, environment, region, modules } = input;

  const workingDirectory = join(context.devshellConfig.environments_dir, environment, region ?? "")


  // Step 1: Init the module and upgrade it's modules
  const initCommand = [
    "terragrunt",
    "--non-interactive",
    "init",
    "--all",
    "-upgrade",
    "--queue-exclude-external",
  ];

  // If modules are specified, add queue flags to scope initialization
  if (modules && modules.length > 0) {
    for (const module of modules) {
      initCommand.push("--queue-include-dir", module);
    }
    initCommand.push("--queue-strict-include");
  }
  const initResult = await context.subprocessManager.execute({
    command: initCommand,
    workingDirectory,
  }).exited;
  if (initResult.exitCode !== 0) {
    throw new CLISubprocessError("Failed to init infrastructure modules", {
      command: initCommand.join(" "),
      subprocessLogs: initResult.output,
      workingDirectory,
    });
  }

  // Step 2: Update the platform locks to include all platforms
  const lockCommand = [
    "terragrunt",
    "--non-interactive",
    "run",
    "--all",
    "--queue-exclude-external",
    "--",
    "providers",
    "lock",
    "-platform=linux_amd64",
    "-platform=linux_arm64",
    "-platform=darwin_amd64",
    "-platform=darwin_arm64",
  ];

  // If modules are specified, add queue flags to scope lock generation
  if (modules && modules.length > 0) {
    // Insert queue flags before the "--" separator
    const separatorIndex = lockCommand.indexOf("--");
    for (const module of modules) {
      lockCommand.splice(separatorIndex, 0, "--queue-include-dir", module);
    }
    lockCommand.splice(lockCommand.indexOf("--"), 0, "--queue-strict-include");
  }
  const lockResult = await context.subprocessManager.execute({
    command: lockCommand,
    workingDirectory,
  }).exited;
  if (lockResult.exitCode !== 0) {
    throw new CLISubprocessError("Failed to generate locks for module providers", {
      command: lockCommand.join(" "),
      subprocessLogs: lockResult.output,
      workingDirectory,
    });
  }
}
