// This file provides utilities for initializing all Terragrunt modules in an environment or region
// It runs terragrunt run-all init to initialize all modules in parallel

import { join } from "node:path"
import { execute } from "@/util/subprocess/execute";
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
}

/**
 * Initializes all Terragrunt modules in an environment or region
 * 
 * @remarks
 * This function uses `terragrunt run-all init` to initialize multiple modules
 * in parallel. It's designed for bulk initialization scenarios where all
 * modules in a directory tree need to be prepared for deployment.
 * 
 * The initialization process:
 * 
 * 1. **Parallel Initialization**: Runs `terragrunt run-all init -upgrade` to:
 *    - Initialize all modules in the directory tree
 *    - Download required Terraform providers for each module
 *    - Set up backend configurations
 *    - Upgrade to latest provider versions
 *    - Respect module dependencies but ignore external ones
 * 
 * 2. **Provider Lock Generation**: Runs `terragrunt run-all providers lock` to:
 *    - Generate provider checksums for all platforms
 *    - Create .terraform.lock.hcl files for each module
 *    - Support Linux (amd64/arm64) and macOS (amd64/arm64)
 *    - Ensure consistent provider versions across all modules
 * 
 * Key behaviors:
 * - If region is provided: initializes all modules in that region
 * - If region is omitted: initializes all modules in the entire environment
 * - Uses `--terragrunt-ignore-external-dependencies` to skip modules outside the tree
 * - Runs non-interactively to prevent prompts
 * - Processes modules in parallel for performance
 * 
 * Common use cases:
 * - Setting up a new environment for the first time
 * - Preparing all modules after provider updates
 * - Bulk initialization after cloning a repository
 * - CI/CD pipeline initialization steps
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
 * @throws {@link CLISubprocessError}
 * Throws when terragrunt run-all init fails
 * 
 * @throws {@link CLISubprocessError}
 * Throws when provider lock generation fails
 * 
 * @see {@link terragruntInit} - For initializing individual modules
 * @see {@link terragruntApplyAll} - For deploying after initialization
 * @see {@link execute} - For subprocess execution details
 */
export async function terragruntInitAll(input: ITerragruntInitAllInput) {
  const { context, environment, region } = input;

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
