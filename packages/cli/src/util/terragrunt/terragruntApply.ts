// This file provides utilities for applying Terragrunt modules
// It executes the terragrunt apply command to deploy infrastructure

import { join } from "node:path";
import { CLISubprocessError } from "@/util/error/error";
import { deleteIaCStateLocks } from "./deleteIaCStateLocks";
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
  /**
   * Optional abort signal that gracefully cancels the terragrunt subprocess
   * when fired. Used by {@link buildDeployModuleTask} to cancel a running
   * apply when a parallel watcher detects a fatal failure.
   *
   * @remarks
   * The signal is forwarded to {@link execute} which sends SIGINT to the
   * terragrunt subprocess's process group. SIGINT is Terraform's documented
   * graceful shutdown signal — terragrunt forwards it to terraform, terraform
   * cancels the in-flight operation and releases the state lock before
   * exiting. There is no SIGKILL escalation timer; the apply is allowed
   * to take as long as it needs to clean up.
   *
   * If the subprocess is force-killed (rapid Ctrl+C, external kill -9, OOM),
   * the `onForceKilled` callback below releases any leaked DynamoDB state
   * lock by delegating to {@link deleteIaCStateLocks}.
   */
  abortSignal?: AbortSignal;
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
 * - `--non-interactive`: Prevents Terragrunt prompts
 * - `--no-color`: Disables Terragrunt color output
 *
 * The apply operation will:
 * 1. Generate an execution plan
 * 2. Apply changes to match the desired state
 * 3. Update the Terraform state file
 * 4. Return any configured outputs
 *
 * If the terragrunt apply subprocess is force-killed (e.g., via rapid Ctrl+C
 * escalation, an external `kill -9`, or the OOM killer), the `onForceKilled`
 * callback automatically releases any leaked DynamoDB state locks by delegating
 * to {@link deleteIaCStateLocks}, so the next run is not blocked indefinitely.
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
  const { context, env, environment, region, module, onLogLine, abortSignal } = input;
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
    "apply",
    "-no-color",
    "-auto-approve",
  ];

  const result = await context.subprocessManager.execute({
    command,
    env,
    workingDirectory,
    onStdOutNewline: onLogLine,
    onStdErrNewline: onLogLine,
    abortSignal,
    // If the terragrunt apply subprocess is force-killed (rapid Ctrl+C
    // escalation, external kill -9, or OOM), terraform never releases the
    // DynamoDB state lock it acquired at the start of the apply. This
    // callback runs in that case and force-deletes any locks held by the
    // current user from DynamoDB so the next run is not blocked.
    //
    // It does NOT run on graceful exit (Ctrl+C → terraform's own SIGINT
    // handler → state lock released cleanly) or on terragrunt error
    // exits (terraform also releases the lock on its own).
    onForceKilled: async () => {
      await deleteIaCStateLocks({
        context,
        directory: workingDirectory,
      });
    },
  }).exited;

  if (result.exitCode !== 0) {
    throw new CLISubprocessError(
      `Failed to apply infrastructure module ${module}`,
      {
        command: command.join(" "),
        subprocessLogs: result.output,
        workingDirectory,
      }
    );
  }
}
