import { dirname, basename, join } from "node:path";
import { Glob } from "bun";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import { asyncIterMap } from "../asyncIterMap";
import { isEnvironmentDeployed } from "./isEnvironmentDeployed";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/util/context/context";

export interface EnvironmentMeta {
    path: string; // Absolute path to the directory for the environment
    name: string; // Name of the environment
    subdomain?: string; // The subdomain assigned to the environment
    deployed: boolean; // True iff the environment has been fully configured; false if in a partially deployed state
}

export async function getEnvironments(context: PanfactumContext): Promise<Array<EnvironmentMeta>> {
    const glob = new Glob("*/environment.yaml");
    return asyncIterMap(glob.scan({ cwd: context.repoVariables.environments_dir }), async path => {
        const filePath = join(context.repoVariables.environments_dir, path)
        const envPath = dirname(filePath);
        try {
            const { environment, environment_subdomain: subdomain } = await getConfigValuesFromFile({ filePath, context }) || {}
            const name = environment ?? basename(envPath);
            return {
                name,
                path: envPath,
                subdomain,
                deployed: await isEnvironmentDeployed({ context, environment: name })
            }
        } catch (e) {
            throw new CLIError("Unable to get environments", e)
        }
    })
}