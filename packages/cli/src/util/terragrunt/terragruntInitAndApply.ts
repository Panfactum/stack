// This file provides utilities for initializing and applying a single Terragrunt module
// It combines terragrunt init and apply operations in sequence

import { terragruntApply } from "./terragruntApply";
import { terragruntInit } from "./terragruntInit";
import type { PanfactumContext } from "@/util/context/context";
import type { CLIError } from "@/util/error/error";

/**
 * Input parameters for initializing and applying a Terragrunt module
 */
interface ITerragruntInitAndApplyInput {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext;
  /** Name of the environment containing the module */
  environment: string;
  /** Name of the region within the environment */
  region: string;
  /** Name of the module to initialize and deploy */
  module: string;
}

/**
 * Initializes and applies a single Terragrunt module
 * 
 * @remarks
 * This convenience function combines the initialization and deployment
 * steps for a single module. It's equivalent to running:
 * 1. `terragrunt init -upgrade`
 * 2. `terragrunt apply -auto-approve`
 * 
 * The function ensures the module is properly initialized before deployment,
 * preventing common errors related to missing providers or backends.
 * 
 * Process flow:
 * 1. **Initialization Phase**: Calls terragruntInit to:
 *    - Download required providers
 *    - Set up backend configuration
 *    - Generate provider lock file
 *    - Upgrade to latest provider versions
 * 
 * 2. **Deployment Phase**: Calls terragruntApply to:
 *    - Create execution plan
 *    - Apply infrastructure changes
 *    - Update state file
 *    - Return deployment status
 * 
 * This is the preferred method for deploying individual modules as it
 * ensures proper initialization state. Use this instead of calling
 * terragruntApply directly unless you're certain initialization is current.
 * 
 * Common use cases:
 * - Deploying a new module for the first time
 * - Updating a module after configuration changes
 * - Automated single-module deployments
 * - Module recovery after state issues
 * 
 * @param input - Configuration for the init and apply operation
 * @returns Promise that resolves when the module is deployed
 * 
 * @example
 * ```typescript
 * // Deploy the VPC module in production
 * await terragruntInitAndApply({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
 *   module: 'aws_vpc'
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Deploy a database module
 * await terragruntInitAndApply({
 *   context,
 *   environment: 'staging',
 *   region: 'eu-west-1',
 *   module: 'aws_rds_postgres'
 * });
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when module initialization fails
 * 
 * @throws {@link CLISubprocessError}
 * Throws when module deployment fails
 * 
 * @see {@link terragruntInit} - For initialization details
 * @see {@link terragruntApply} - For deployment details
 * @see {@link terragruntInitAndApplyAll} - For bulk operations
 */
export async function terragruntInitAndApply(input: ITerragruntInitAndApplyInput): Promise<void | CLIError> {
  await terragruntInit(input);
  return terragruntApply(input);
}
