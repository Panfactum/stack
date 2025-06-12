import { dirname, basename, join } from "node:path";
import { Glob } from "bun";
import { asyncIterMap } from "@/util/asyncIterMap";
import { isBastionDeployed } from "@/util/config/isBastionDeployed.ts";
import { CLIError } from "@/util/error/error";
import { GLOBAL_REGION } from "@/util/terragrunt/constants";
import { getPanfactumConfig } from "./getPanfactumConfig";
import { isClusterDeployed } from "./isClusterDeployed";
import type { PanfactumContext } from "@/util/context/context";

export interface RegionMeta {
    path: string; // Absolute path to the directory for the region
    name: string; // Name of the region
    primary: boolean; // Whether the region has the state bucket
    clusterContextName: string | undefined; // The name of the cluster context for this region
    clusterDeployed: boolean; // Whether the region has a cluster deployed
    bastionDeployed: boolean;
    vaultAddress: string | undefined; // Optional vault address for the region
    awsProfile?: string; // Optional AWS region for the region
}

export async function getRegions(context: PanfactumContext, envPath: string): Promise<Array<RegionMeta>> {
    const { tf_state_region: primaryRegion } = await getPanfactumConfig({ context, directory: envPath }) || {}
    const glob = new Glob("*/region.yaml");

    return asyncIterMap(glob.scan({ cwd: envPath }), async path => {
        const filePath = join(envPath, path)
        const regionPath = dirname(filePath);
        try {
            const { region, aws_region: awsRegion, aws_profile: awsProfile, kube_api_server: kubeApiServer, environment, kube_config_context, vault_addr } = await getPanfactumConfig({ directory: regionPath, context }) || {}

            const name = region ?? basename(regionPath)

            const clusterDeployed = !!(environment && region && kubeApiServer && await isClusterDeployed({ context, environment, region }))
            const bastionDeployed = clusterDeployed && await isBastionDeployed({ context, environment, region })

            return {
                name,
                path: regionPath,
                primary: primaryRegion === awsRegion && name !== GLOBAL_REGION,
                clusterDeployed,
                bastionDeployed,
                clusterContextName: kube_config_context,
                vaultAddress: vault_addr,
                awsProfile
            }
        } catch (e) {
            throw new CLIError("Unable to get regions", e)
        }
    })
}