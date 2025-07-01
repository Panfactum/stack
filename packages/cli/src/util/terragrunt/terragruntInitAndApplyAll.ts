// This file provides utilities for initializing and applying all Terragrunt modules
// It combines terragrunt run-all init and apply operations in sequence

import { terragruntApplyAll } from "./terragruntApplyAll";
import { terragruntInitAll } from "./terragruntInitAll";
import type { PanfactumContext } from "@/util/context/context";
import type { CLIError } from "@/util/error/error";

/**
 * Input parameters for initializing and applying all Terragrunt modules
 */
interface ITerragruntInitAndApplyAllInput {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext;
  /** Name of the environment to deploy */
  environment: string;
  /** Name of the region within the environment */
  region: string;
}

/**
 * Initializes and applies all Terragrunt modules in a region
 * 
 * @remarks
 * This convenience function combines the initialization and deployment
 * steps for all modules in a region. It's equivalent to running:
 * 1. `terragrunt run-all init -upgrade`
 * 2. `terragrunt run-all apply -auto-approve`
 * 
 * The function ensures modules are properly initialized before deployment,
 * preventing common errors related to missing providers or backends.
 * 
 * Process flow:
 * 1. **Initialization Phase**: Calls terragruntInitAll to:
 *    - Download all required providers
 *    - Set up backend configurations
 *    - Generate provider lock files
 * 
 * 2. **Deployment Phase**: Calls terragruntApplyAll to:
 *    - Apply all module configurations
 *    - Respect dependency order
 *    - Run modules in parallel where possible
 * 
 * Common use cases:
 * - Initial environment deployment from scratch
 * - Disaster recovery scenarios
 * - Automated deployments in CI/CD pipelines
 * - Bulk updates across all infrastructure
 * 
 * @param input - Configuration for the init and apply operation
 * @returns Promise that resolves when all modules are deployed
 * 
 * @example
 * ```typescript
 * // Deploy all modules in production us-east-1
 * await terragruntInitAndApplyAll({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1'
 * });
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when initialization fails for any module
 * 
 * @throws {@link CLISubprocessError}
 * Throws when deployment fails for any module
 * 
 * @see {@link terragruntInitAll} - For initialization details
 * @see {@link terragruntApplyAll} - For deployment details
 * @see {@link terragruntInitAndApply} - For single module operations
 */
export async function terragruntInitAndApplyAll(input: ITerragruntInitAndApplyAllInput): Promise<void | CLIError> {
  await terragruntInitAll(input);
  return terragruntApplyAll(input);
}
