// This file provides utilities for applying Terragrunt modules
// It executes the terragrunt apply command to deploy infrastructure

import { join } from "node:path";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for Terragrunt apply operation
 */
interface ITerragruntApplyInput {
  /** Panfactum context for configuration */
  context: PanfactumContext;
  /** Additional environment variables for Terragrunt */
  env?: Record<string, string | undefined>;
  /** Name of the environment */
  environment: string;
  /** Name of the region */
  region: string;
  /** Name of the module to apply */
  module: string;
  /** Callback for streaming log output */
  onLogLine?: (line: string) => void;
}

/**
 * Applies a Terragrunt module to deploy infrastructure
 * 
 * @remarks
 * This function executes `terragrunt apply` to deploy or update infrastructure
 * resources defined in the module. It uses the following flags:
 * 
 * - `-auto-approve`: Skips interactive approval prompt
 * - `-no-color`: Disables terminal color codes
 * - `--terragrunt-non-interactive`: Prevents Terragrunt prompts
 * - `--terragrunt-no-color`: Disables Terragrunt color output
 * 
 * The apply operation will:
 * 1. Generate an execution plan
 * 2. Apply changes to match the desired state
 * 3. Update the Terraform state file
 * 4. Return any configured outputs
 * 
 * Important considerations:
 * - Module must be initialized before applying
 * - Apply operations can modify or destroy resources
 * - State locking prevents concurrent modifications
 * - Failed applies may leave resources in partial states
 * 
 * @param input - Configuration for the apply operation
 * 
 * @example
 * ```typescript
 * await terragruntApply({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
 *   module: 'aws_vpc',
 *   env: {
 *     TF_VAR_instance_count: '3'
 *   },
 *   onLogLine: (line) => console.log(`[APPLY] ${line}`)
 * });
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when Terragrunt apply fails due to:
 * - Configuration errors
 * - Provider authentication issues
 * - Resource conflicts
 * - State lock conflicts
 * - Infrastructure provisioning errors
 * 
 * @see {@link terragruntInit} - Must be run before applying
 * @see {@link terragruntInitAndApply} - Combined init and apply operation
 * @see {@link updateModuleStatus} - For tracking deployment status
 */
export async function terragruntApply(
  input: ITerragruntApplyInput
): Promise<void> {
  const { context, env, environment, region, module, onLogLine } = input;
  const workingDirectory = join(
    context.repoVariables.environments_dir,
    environment,
    region,
    module
  );

  await execute({
    command: [
      "terragrunt",
      "apply",
      "-no-color",
      "-auto-approve",
      "--terragrunt-non-interactive",
      "--terragrunt-no-color",
    ],
    context,
    env,
    workingDirectory,
    errorMessage: `Failed to apply infrastructure module ${module}`,
    onStdOutNewline: onLogLine,
    onStdErrNewline: onLogLine,
  });
}
