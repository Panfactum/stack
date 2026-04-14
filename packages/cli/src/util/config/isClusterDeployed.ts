// This file provides utilities for checking if a Kubernetes cluster is fully deployed in a region
// It verifies all setupClusterExtensions modules and anti-affinity adjustments are complete

import { join } from "node:path";
import { z } from "zod";
import { MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
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
 * Modules added as new deployments during the setupClusterExtensions step
 *
 * @internal
 */
const CLUSTER_EXTENSION_NEW_MODULES = [
  MODULES.KUBE_BASTION,
  MODULES.KUBE_EXTERNAL_SNAPSHOTTER,
  MODULES.KUBE_VELERO,
  MODULES.KUBE_KEDA,
  MODULES.KUBE_RELOADER,
  MODULES.KUBE_PVC_AUTORESIZER,
  MODULES.KUBE_DESCHEDULER,
  MODULES.KUBE_CLOUDNATIVE_PG,
] as const;

/**
 * Modules that are re-applied with bootstrap_mode_enabled=false during the
 * anti-affinity adjustment phase of setupClusterExtensions
 *
 * @internal
 */
const ANTI_AFFINITY_MODULES = [
  MODULES.AWS_EKS,
  MODULES.KUBE_VAULT,
  MODULES.KUBE_CERTIFICATES,
  MODULES.KUBE_LINKERD,
  MODULES.KUBE_INGRESS_NGINX,
] as const;

/**
 * Zod schema for reading bootstrap_mode_enabled from a module.yaml file
 *
 * @internal
 */
const BOOTSTRAP_MODE_SCHEMA = z.object({
  extra_inputs: z
    .object({
      bootstrap_mode_enabled: z.boolean(),
    })
    .optional(),
});

/**
 * Checks if a Kubernetes cluster is successfully deployed in a region
 *
 * @remarks
 * A cluster is considered fully deployed only when ALL phases of `pf cluster add`
 * have completed successfully:
 *
 * 1. All new modules introduced in `setupClusterExtensions` have
 *    `deploy_status === "success"` — this includes `kube_bastion`,
 *    `kube_external_snapshotter`, `kube_velero`, `kube_keda`, `kube_reloader`,
 *    `kube_pvc_autoresizer`, `kube_descheduler`, and `kube_cloudnative_pg`.
 * 2. All anti-affinity-adjusted modules have `bootstrap_mode_enabled === false`
 *    in their `module.yaml`, confirming they have been taken out of bootstrap mode.
 *
 * Checking only `kube_reloader` (as a simple proxy) is insufficient because
 * `kube_reloader` is deployed concurrently with other modules in
 * `setupClusterExtensions`. It can succeed while a sibling task fails, which
 * would cause `pf cluster add` to hide the region on re-run even though the
 * installation is incomplete.
 *
 * @param inputs - Parameters specifying which region to check
 * @returns True if the cluster is fully deployed, false otherwise
 *
 * @example
 * ```typescript
 * const hasCluster = await isClusterDeployed({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
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
  const regionPath = join(context.devshellConfig.environments_dir, environment, region);

  // Check that all new modules from setupClusterExtensions are successfully deployed
  const extensionStatuses = await Promise.all(
    CLUSTER_EXTENSION_NEW_MODULES.map((module) =>
      getModuleStatus({ context, environment, region, module })
    )
  );

  if (extensionStatuses.some((s) => s.deploy_status !== "success")) {
    return false;
  }

  // Check that all anti-affinity adjustments have been applied
  // (i.e., bootstrap_mode_enabled has been set to false for each module)
  const moduleYamlResults = await Promise.all(
    ANTI_AFFINITY_MODULES.map((module) =>
      readYAMLFile({
        filePath: join(regionPath, module, "module.yaml"),
        context,
        throwOnMissing: false,
        validationSchema: BOOTSTRAP_MODE_SCHEMA,
      })
    )
  );

  // Only treat the adjustment as incomplete when bootstrap_mode_enabled is explicitly true.
  // A missing file or missing field means the module was not configured with bootstrap mode
  // and the check should not block completion detection.
  return moduleYamlResults.every(
    (result) => result?.extra_inputs?.bootstrap_mode_enabled !== true
  );
}
