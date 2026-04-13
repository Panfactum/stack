// This file provides utilities for bootstrapping Terragrunt remote state backend
// It runs terragrunt backend bootstrap to provision S3 bucket and DynamoDB lock table

import { join } from "node:path";
import { CLISubprocessError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for Terragrunt backend bootstrapping
 */
interface ITerragruntBackendBootstrapInput {
  /** Panfactum context for configuration */
  context: PanfactumContext;
  /** Name of the environment */
  environment: string;
  /** Name of the region */
  region: string;
  /** Name of the module to bootstrap */
  module: string;
  /** Callback for streaming log output */
  onLogLine?: (line: string) => void;
}

/**
 * Bootstraps the Terragrunt remote state backend for a module
 *
 * @remarks
 * This function runs `terragrunt backend bootstrap` to explicitly provision
 * the remote state backend infrastructure (S3 bucket and DynamoDB lock table).
 *
 * Historically, Terragrunt would auto-provision backend infrastructure during
 * `terragrunt init`. This utility makes that bootstrapping process explicit
 * by running a dedicated command that:
 *
 * 1. **Creates S3 bucket**: Provisions the S3 bucket for storing Terraform state
 * 2. **Creates DynamoDB table**: Sets up the DynamoDB table for state locking
 * 3. **Configures access policies**: Establishes proper IAM permissions
 * 4. **Enables encryption**: Configures server-side encryption for state
 *
 * The function uses the following global Terragrunt options:
 * - `--non-interactive`: Prevents interactive prompts
 * - `--no-color`: Disables color output for cleaner logs
 * - `--working-dir`: Specifies the module directory to bootstrap
 *
 * This bootstrapping should be run:
 * - Before the first `terragrunt init` in a new environment
 * - When setting up infrastructure in a new region
 * - When recovering from backend configuration issues
 *
 * @param input - Configuration for the bootstrap operation
 *
 * @example
 * ```typescript
 * await terragruntBackendBootstrap({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
 *   module: 'aws_vpc',
 *   onLogLine: (line) => console.log(`[BOOTSTRAP] ${line}`)
 * });
 * ```
 *
 * @throws {@link CLISubprocessError}
 * Throws when backend bootstrap fails due to:
 * - AWS authentication issues
 * - Insufficient IAM permissions
 * - Resource naming conflicts
 * - Network connectivity problems
 * - Invalid backend configuration
 *
 * @see {@link terragruntInit} - Should be run after backend bootstrap
 * @see {@link terragruntApply} - For deploying modules after initialization
 * @see {@link execute} - For subprocess execution details
 */
export async function terragruntBackendBootstrap(
  input: ITerragruntBackendBootstrapInput
): Promise<void> {
  const { context, environment, region, module, onLogLine } = input;
  const workingDirectory = join(
    context.devshellConfig.environments_dir,
    environment,
    region,
    module
  );

  const command = [
    "terragrunt",
    "--non-interactive",
    "--no-color",
    "--working-dir",
    workingDirectory,
    "backend",
    "bootstrap",
  ];

  const result = await context.subprocessManager.execute({
    command,
    workingDirectory,
    onStdOutNewline: onLogLine,
    onStdErrNewline: onLogLine,
  }).exited;

  if (result.exitCode !== 0) {
    throw new CLISubprocessError(
      `Failed to bootstrap backend for infrastructure module ${module}`,
      {
        command: command.join(" "),
        subprocessLogs: result.output,
        workingDirectory,
      }
    );
  }
}