import {dirname, basename,join} from "node:path";
import { Glob } from "bun";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import { asyncIterMap } from "../asyncIterMap";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";

interface EnvironmentMeta {
    path: string; // Absolute path to the directory for the environment
    name: string; // Name of the environment
}

export async function getEnvironments(context: PanfactumContext): Promise<Array<EnvironmentMeta>> {

    const glob = new Glob("*/environment.yaml");
    return asyncIterMap(glob.scan({ cwd: context.repoVariables.environments_dir }), async path => {
        const filePath = join(context.repoVariables.environments_dir, path)
        const envPath = dirname(filePath);
        try {
            const {environment} = await getConfigValuesFromFile({filePath: path, context}) || {}
            return {
                name: environment ?? basename(envPath),
                path: envPath
            }
        } catch (e) {
            throw new CLIError("Unable to get environments", e)
        }
    })
}