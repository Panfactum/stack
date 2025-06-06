import { dirname, basename, join } from "node:path";
import { Glob } from "bun";
import { asyncIterMap } from "@/util/asyncIterMap";
import { CLIError } from "@/util/error/error";
import { GLOBAL_REGION } from "@/util/terragrunt/constants";
import { getPanfactumConfig } from "./getPanfactumConfig";
import { isClusterDeployed } from "./isClusterDeployed";
import type { PanfactumContext } from "@/util/context/context";

export interface RegionMeta {
    path: string; // Absolute path to the directory for the region
    name: string; // Name of the region
    primary: boolean; // Whether the region has the state bucket
    clusterDeployed: boolean; // Whether the region has a cluster deployed
}

export async function getRegions(context: PanfactumContext, envPath: string): Promise<Array<RegionMeta>> {
    const { tf_state_region: primaryRegion } = await getPanfactumConfig({ context, directory: envPath }) || {}
    const glob = new Glob("*/region.yaml");

    return asyncIterMap(glob.scan({ cwd: envPath }), async path => {
        const filePath = join(envPath, path)
        const regionPath = dirname(filePath);
        try {
            const { region, aws_region: awsRegion, kube_api_server: kubeApiServer, environment } = await getPanfactumConfig({ directory: regionPath, context }) || {}

            const name = region ?? basename(regionPath)

            return {
                name,
                path: regionPath,
                primary: primaryRegion === awsRegion && name !== GLOBAL_REGION,
                // todo: handle null check inside isClusterDeployed
                clusterDeployed: !!(environment && region && kubeApiServer && await isClusterDeployed({ context, environment, region })),
            }
        } catch (e) {
            throw new CLIError("Unable to get regions", e)
        }
    })
}