// This file provides utilities for checking if a Kubernetes cluster is deployed in a region
// It uses the kube_reloader module as a marker for cluster deployment status

import { MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for checking cluster deployment status
 */
interface IIsClusterDeployedInput {
  /** Panfactum context for configuration access */
  context: PanfactumContext;
  /** Environment name to check */
  environment: string;
  /** Region name within the environment */
  region: string;
}

/**
 * Checks if a Kubernetes cluster is successfully deployed in a region
 * 
 * @remarks
 * This function checks the deployment status of the kube_reloader module
 * as a proxy for determining if a Kubernetes cluster is deployed. The
 * kube_reloader is a core component that's deployed early in the cluster
 * setup process, making it a reliable indicator of cluster existence.
 * 
 * A cluster is considered deployed only if the kube_reloader module's
 * deployment status is "success".
 * 
 * @todo Figure out a better marker to determine if a cluster is deployed
 * 
 * @param inputs - Parameters specifying which region to check
 * @returns True if the cluster is successfully deployed, false otherwise
 * 
 * @example
 * ```typescript
 * const hasCluster = await isClusterDeployed({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1'
 * });
 * 
 * if (hasCluster) {
 *   console.log('Can deploy Kubernetes resources to this region');
 * }
 * ```
 * 
 * @see {@link getModuleStatus} - For checking module deployment status
 * @see {@link MODULES} - Module name constants
 */
export async function isClusterDeployed(inputs: IIsClusterDeployedInput): Promise<boolean> {
  const { context, environment, region } = inputs;

  const status = await getModuleStatus({
    context,
    region,
    environment,
    // todo: figure out a better mark to determine if a cluster is deployed
    module: MODULES.KUBE_RELOADER
  })
  return status.deploy_status === "success"
}