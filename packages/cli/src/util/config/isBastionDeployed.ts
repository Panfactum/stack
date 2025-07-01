// This file provides utilities for checking if a bastion host is deployed in a region
// Bastion hosts provide secure SSH access to private infrastructure

import { MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for checking bastion deployment status
 */
interface IIsBastionDeployedInput {
  /** Panfactum context for configuration access */
  context: PanfactumContext;
  /** Environment name to check */
  environment: string;
  /** Region name within the environment */
  region: string;
}

/**
 * Checks if a bastion host is successfully deployed in a region
 * 
 * @remarks
 * This function checks the deployment status of the kube_bastion module
 * in the specified environment and region. A bastion is considered
 * deployed only if its deployment status is "success".
 * 
 * Bastion hosts are essential for:
 * - Secure SSH access to private subnets
 * - Running administrative commands on Kubernetes nodes
 * - Debugging infrastructure in private networks
 * - Establishing SSH tunnels for database access
 * 
 * @param inputs - Parameters specifying which region to check
 * @returns True if the bastion is successfully deployed, false otherwise
 * 
 * @example
 * ```typescript
 * const hasBastion = await isBastionDeployed({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1'
 * });
 * 
 * if (hasBastion) {
 *   console.log('Can use SSH tunneling through bastion');
 * }
 * ```
 * 
 * @see {@link getModuleStatus} - For checking module deployment status
 * @see {@link MODULES} - Module name constants
 */
export async function isBastionDeployed(inputs: IIsBastionDeployedInput): Promise<boolean> {
  const { context, environment, region } = inputs;

  const status = await getModuleStatus({
    context,
    region,
    environment,
    module: MODULES.KUBE_BASTION
  })
  return status.deploy_status === "success"
}