// This file provides utilities for running Terragrunt apply on all modules in a region
// It executes infrastructure deployments across multiple modules simultaneously

import { join } from "node:path";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for applying all Terragrunt modules
 */
interface ITerragruntApplyAllInput {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext;
  /** Additional environment variables for Terragrunt execution */
  env?: Record<string, string | undefined>;
  /** Name of the environment to deploy */
  environment: string;
  /** Name of the region within the environment */
  region: string;
  /** Callback function for processing log output lines */
  onLogLine?: (line: string) => void;
}

/**
 * Applies all Terragrunt modules within a region using run-all command
 * 
 * @remarks
 * This function executes `terragrunt run-all apply` to deploy all modules
 * in a specific region. It's designed for bulk operations where multiple
 * modules need to be deployed or updated together.
 * 
 * The function:
 * - Automatically approves all changes (non-interactive mode)
 * - Runs modules in dependency order
 * - Executes modules in parallel where possible
 * - Streams output through the onLogLine callback
 * 
 * This is typically used for:
 * - Initial environment deployments
 * - Bulk updates across all modules
 * - Disaster recovery scenarios
 * - Environment synchronization
 * 
 * @param input - Configuration for the apply-all operation
 * 
 * @example
 * ```typescript
 * await terragruntApplyAll({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
 *   env: { AWS_PROFILE: 'prod-admin' },
 *   onLogLine: (line) => console.log(`[APPLY] ${line}`)
 * });
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when Terragrunt execution fails
 * 
 * @see {@link terragruntInitAll} - Should be run before apply-all
 * @see {@link terragruntApply} - For applying individual modules
 * @see {@link execute} - For subprocess execution details
 */
export async function terragruntApplyAll(input: ITerragruntApplyAllInput): Promise<void> {
  const {
    context,
    env,
    environment,
    region,
    onLogLine
  } = input;
  const workingDirectory = join(
    context.devshellConfig.environments_dir,
    environment,
    region
  );
  await execute({
    command: [
      "terragrunt",
      "run-all",
      "apply",
      "-auto-approve",
      "--terragrunt-non-interactive",
    ],
    env,
    context,
    workingDirectory,
    errorMessage: "Failed to apply infrastructure modules",
    onStdOutNewline: onLogLine,
    onStdErrNewline: onLogLine,
  });
}
