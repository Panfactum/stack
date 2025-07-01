// This file provides utilities for checking if a Panfactum environment is deployed
// It checks the deployment status of core AWS account infrastructure

import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for checking environment deployment status
 */
interface IIsEnvironmentDeployedInput {
  /** Panfactum context for configuration access */
  context: PanfactumContext;
  /** Environment name to check */
  environment: string;
}

/**
 * Checks if a Panfactum environment is successfully deployed
 * 
 * @remarks
 * This function determines if an environment is deployed by checking
 * the deployment status of its foundational AWS infrastructure:
 * 
 * - For the management environment: Checks the aws_organization module
 * - For other environments: Checks the aws_account module
 * 
 * These modules are deployed in the global region and establish the
 * AWS account structure needed for an environment. An environment is
 * considered deployed only if the relevant module's deployment status
 * is "success".
 * 
 * @param inputs - Parameters specifying which environment to check
 * @returns True if the environment is successfully deployed, false otherwise
 * 
 * @example
 * ```typescript
 * const isDeployed = await isEnvironmentDeployed({
 *   context,
 *   environment: 'production'
 * });
 * 
 * if (isDeployed) {
 *   console.log('Environment AWS account is ready');
 * } else {
 *   console.log('Need to deploy environment infrastructure first');
 * }
 * ```
 * 
 * @see {@link getModuleStatus} - For checking module deployment status
 * @see {@link MODULES} - Module name constants
 * @see {@link GLOBAL_REGION} - Special region for global resources
 * @see {@link MANAGEMENT_ENVIRONMENT} - Special environment for organization management
 */
export async function isEnvironmentDeployed(inputs: IIsEnvironmentDeployedInput): Promise<boolean> {
    const { context, environment } = inputs;

    const status = await getModuleStatus({
        context,
        region: GLOBAL_REGION,
        environment: environment,
        module: environment === MANAGEMENT_ENVIRONMENT ? MODULES.AWS_ORGANIZATION : MODULES.AWS_ACCOUNT
    })
    return status.deploy_status === "success"
}