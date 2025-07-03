// This file provides utilities for discovering and loading Panfactum regions within an environment
// It scans environment directories for region.yaml files and extracts metadata

import { dirname, basename, join } from "node:path";
import { Glob } from "bun";
import { isBastionDeployed } from "@/util/config/isBastionDeployed.ts";
import { CLIError } from "@/util/error/error";
import { GLOBAL_REGION } from "@/util/terragrunt/constants";
import { asyncIterMap } from "@/util/util/asyncIterMap";
import { getPanfactumConfig } from "./getPanfactumConfig";
import { isClusterDeployed } from "./isClusterDeployed";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Metadata about a Panfactum region
 * 
 * @remarks
 * Contains all the information needed to work with a region,
 * including its AWS configuration, cluster status, and infrastructure deployment state.
 */
export interface IRegionMeta {
    /** Absolute path to the directory for the region */
    path: string;
    /** Name of the region */
    name: string;
    /** AWS region name, e.g. "us-east-1" */
    awsRegion: string | undefined;
    /** Whether this is the primary region hosting the Terraform state bucket */
    primary: boolean;
    /** The kubectl context name for this region's cluster */
    clusterContextName: string | undefined;
    /** Whether the region has a Kubernetes cluster deployed */
    clusterDeployed: boolean;
    /** Whether the region has a bastion host deployed */
    bastionDeployed: boolean;
    /** Vault server address for this region */
    vaultAddress: string | undefined;
    /** Optional AWS profile override for this region */
    awsProfile?: string;
}

/**
 * Discovers all Panfactum regions within an environment
 * 
 * @remarks
 * This function scans an environment directory for all subdirectories
 * containing a `region.yaml` file. For each region found:
 * 
 * 1. Reads the region configuration using hierarchical config loading
 * 2. Extracts the region name (from config or directory name)
 * 3. Determines if this is the primary region (hosts state bucket)
 * 4. Checks if a Kubernetes cluster is deployed
 * 5. Checks if a bastion host is deployed (requires cluster)
 * 6. Collects metadata like AWS region, Vault address, and kubectl context
 * 
 * The primary region is identified by comparing its AWS region with the
 * Terraform state region configured at the environment level.
 * 
 * @param context - Panfactum context for configuration access
 * @param envPath - Absolute path to the environment directory
 * @returns Array of region metadata objects
 * 
 * @example
 * ```typescript
 * const envPath = '/repo/environments/production';
 * const regions = await getRegions(context, envPath);
 * 
 * // Find primary region
 * const primary = regions.find(r => r.primary);
 * console.log(`State bucket is in ${primary?.awsRegion}`);
 * 
 * // List regions with clusters
 * const withClusters = regions.filter(r => r.clusterDeployed);
 * console.log(`${withClusters.length} regions have clusters`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to read or parse region configuration files
 * 
 * @see {@link getPanfactumConfig} - For loading hierarchical configuration
 * @see {@link isClusterDeployed} - For checking cluster deployment status
 * @see {@link isBastionDeployed} - For checking bastion deployment status
 */
export async function getRegions(context: PanfactumContext, envPath: string): Promise<Array<IRegionMeta>> {
    const { tf_state_region: primaryRegion } = await getPanfactumConfig({ context, directory: envPath }) || {}
    const glob = new Glob("*/region.yaml");

    return asyncIterMap(glob.scan({ cwd: envPath }), async path => {
        const filePath = join(envPath, path)
        const regionPath = dirname(filePath);
        try {
            const { region, aws_region: awsRegion, aws_profile: awsProfile, kube_api_server: kubeApiServer, environment, kube_config_context: kubeConfigContext, vault_addr: vaultAddr } = await getPanfactumConfig({ directory: regionPath, context }) || {}

            const name = region ?? basename(regionPath)

            const clusterDeployed = !!(environment && region && kubeApiServer && await isClusterDeployed({ context, environment, region }))
            const bastionDeployed = clusterDeployed && await isBastionDeployed({ context, environment, region })

            return {
                name,
                awsRegion: awsRegion,
                path: regionPath,
                primary: primaryRegion === awsRegion && name !== GLOBAL_REGION,
                clusterDeployed,
                bastionDeployed,
                clusterContextName: kubeConfigContext,
                vaultAddress: vaultAddr,
                awsProfile
            }
        } catch (e) {
            throw new CLIError("Unable to get regions", e)
        }
    })
}