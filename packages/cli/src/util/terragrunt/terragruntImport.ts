// This file provides utilities for importing existing resources into Terraform state
// It handles the Terragrunt import command to bring external resources under management

import { join } from "node:path"
import { CLIError } from "@/util/error/error";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for importing resources into Terragrunt state
 */
interface ITerragruntImportInput {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext;
  /** Terraform resource path (e.g., "aws_s3_bucket.my_bucket") */
  resourcePath: string;
  /** External resource ID to import */
  resourceId: string;
  /** Name of the environment containing the module */
  environment: string;
  /** Name of the region within the environment */
  region: string;
  /** Name of the module to import into */
  module: string;
  /** Whether to throw error if resource already exists in state */
  throwOnExists?: boolean;
  /** Callback function for processing log output lines */
  onLogLine?: (line: string) => void;
}

/**
 * Imports existing resources into Terragrunt/Terraform state
 * 
 * @remarks
 * This function imports external resources that were created outside of
 * Terraform into the Terraform state file. This is useful for:
 * - Adopting manually created resources
 * - Migrating resources between modules
 * - Recovering from state inconsistencies
 * - Bringing legacy infrastructure under IaC management
 * 
 * The function:
 * 1. Checks if the resource already exists in state
 * 2. Optionally throws an error if it exists (based on throwOnExists)
 * 3. Imports the resource if it doesn't exist
 * 
 * Import operations require:
 * - The resource must exist in the cloud provider
 * - The Terraform configuration must match the resource
 * - Proper permissions to read the resource
 * 
 * @param input - Configuration for the import operation
 * 
 * @example
 * ```typescript
 * // Import an existing S3 bucket
 * await terragruntImport({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
 *   module: 'aws_s3_buckets',
 *   resourcePath: 'aws_s3_bucket.logs',
 *   resourceId: 'my-existing-logs-bucket',
 *   throwOnExists: true
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Import an existing EC2 instance
 * await terragruntImport({
 *   context,
 *   environment: 'staging',
 *   region: 'us-west-2',
 *   module: 'aws_ec2_instances',
 *   resourcePath: 'aws_instance.web_server',
 *   resourceId: 'i-0123456789abcdef0',
 *   onLogLine: (line) => console.log(`[IMPORT] ${line}`)
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when resource already exists and throwOnExists is true
 * 
 * @throws {@link CLISubprocessError}
 * Throws when state check or import command fails
 * 
 * @see {@link execute} - For subprocess execution details
 * @see {@link terragruntApply} - Should be run after import to sync configuration
 */
export async function terragruntImport(input: ITerragruntImportInput): Promise<void> {
  const {
  context,
  environment,
  region,
  module,
  resourceId,
  resourcePath,
  throwOnExists,
  onLogLine
  } = input;


  const workingDirectory = join(context.repoVariables.environments_dir, environment, region, module)

  // Step 1: Check if it already imported
  const { exitCode } = await execute({
    command: [
      "terragrunt",
      "state",
      "show",
      "-no-color",
      resourcePath,
      "--terragrunt-non-interactive",
      "--terragrunt-no-color"
    ],
    context,
    workingDirectory,
    errorMessage: "Failed to check state of infrastructure modules",
    onStdErrNewline: onLogLine,
    onStdOutNewline: onLogLine,
    isSuccess: () => true
  })

  // That means the resource already exists in the state
  // so we cannot import
  if (exitCode === 0) {
    if (throwOnExists) {
      throw new CLIError(`Cannot import resource ${resourcePath} because it already exists in the state file`)
    }
    return
  }

  // Step 2: Import the resource
  await execute({
    command: [
      "terragrunt",
      "import",
      "-no-color",
      resourcePath,
      resourceId,
      "--terragrunt-no-color"
    ],
    context,
    workingDirectory,
    errorMessage: `Failed to import ${resourceId} to ${resourcePath}`,
    onStdOutNewline: onLogLine,
    onStdErrNewline: onLogLine
  })
}
