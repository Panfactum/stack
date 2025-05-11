import { dirname, basename, join } from "node:path";
import { Glob } from "bun";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import { asyncIterMap } from "../asyncIterMap";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/util/context/context";

export interface RegionMeta {
    path: string; // Absolute path to the directory for the region
    name: string; // Name of the region
}

export async function getRegions(context: PanfactumContext, envPath: string): Promise<Array<RegionMeta>> {
    const glob = new Glob("*/region.yaml");
    return asyncIterMap(glob.scan({ cwd: envPath }), async path => {
        const filePath = join(envPath, path)
        const regionPath = dirname(filePath);
        try {
            const { region } = await getConfigValuesFromFile({ filePath, context }) || {}
            return {
                name: region ?? basename(regionPath),
                path: regionPath
            }
        } catch (e) {
            throw new CLIError("Unable to get regions", e)
        }
    })
}