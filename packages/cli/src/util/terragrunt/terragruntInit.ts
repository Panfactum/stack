// This file provides utilities for initializing Terragrunt modules
// It runs terragrunt init and sets up provider locks for cross-platform compatibility

import { join } from "node:path";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for Terragrunt initialization
 */
interface ITerragruntInitInput {
  /** Panfactum context for configuration */
  context: PanfactumContext;
  /** Additional environment variables for Terragrunt */
  env?: Record<string, string | undefined>;
  /** Name of the environment */
  environment: string;
  /** Name of the region */
  region: string;
  /** Name of the module to initialize */
  module: string;
  /** Callback for streaming log output */
  onLogLine?: (line: string) => void;
}

/**
 * Initializes a Terragrunt module for deployment
 * 
 * @remarks
 * This function performs a complete Terragrunt initialization process:
 * 
 * 1. **Module Initialization**: Runs `terragrunt init -upgrade` to:
 *    - Download required Terraform providers
 *    - Initialize backend configuration
 *    - Upgrade to latest provider versions
 *    - Set up module dependencies
 * 
 * 2. **Provider Lock Generation**: Runs `terragrunt providers lock` to:
 *    - Generate provider checksums for all platforms
 *    - Ensure consistent provider versions across teams
 *    - Support Linux (amd64/arm64) and macOS (amd64/arm64)
 *    - Create .terraform.lock.hcl file
 * 
 * The function uses several Terragrunt flags:
 * - `--terragrunt-non-interactive`: Prevents interactive prompts
 * - `--terragrunt-no-color`: Disables color output for cleaner logs
 * - `--terragrunt-provider-cache`: Uses shared provider cache
 * 
 * This initialization is required before:
 * - Running terragrunt plan or apply
 * - Updating module configurations
 * - Switching between environments
 * 
 * @param input - Configuration for the initialization process
 * 
 * @example
 * ```typescript
 * await terragruntInit({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
 *   module: 'aws_vpc',
 *   onLogLine: (line) => console.log(`[INIT] ${line}`)
 * });
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when Terragrunt init fails
 * 
 * @throws {@link CLISubprocessError}
 * Throws when provider lock generation fails
 * 
 * @see {@link execute} - For running Terragrunt commands
 * @see {@link terragruntApply} - For deploying after initialization
 * @see {@link updateModuleStatus} - For tracking init status
 */
export async function terragruntInit(
  input: ITerragruntInitInput
): Promise<void> {
  const { context, env, environment, region, module, onLogLine } = input;
  const workingDirectory = join(
    context.devshellConfig.environments_dir,
    environment,
    region,
    module
  );

  // Step 1: Init the module and upgrade it's modules
  await execute({
    command: [
      "terragrunt",
      "init",
      "-upgrade",
      "-no-color",
      "--terragrunt-non-interactive",
      "--terragrunt-no-color",
      "--terragrunt-provider-cache"
    ],
    context,
    env,
    workingDirectory,
    errorMessage: "Failed to init infrastructure modules",
    onStdErrNewline: onLogLine,
    onStdOutNewline: onLogLine,
  });

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
      "--terragrunt-no-color",
      "--terragrunt-provider-cache"

    ],
    context,
    env,
    workingDirectory,
    errorMessage: "Failed to generate locks for module providers",
    onStdErrNewline: onLogLine,
    onStdOutNewline: onLogLine,
  });
}
