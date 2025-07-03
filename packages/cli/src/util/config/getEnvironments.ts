// This file provides utilities for discovering and loading Panfactum environments
// It scans the environments directory for environment.yaml files and extracts metadata

import { dirname, basename, join } from "node:path";
import { Glob } from "bun";
import { CLIError } from "@/util/error/error";
import { asyncIterMap } from "@/util/util/asyncIterMap";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import { isEnvironmentDeployed } from "./isEnvironmentDeployed";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Metadata about a Panfactum environment
 * 
 * @remarks
 * Contains all the information needed to work with an environment,
 * including its location, deployment status, and configuration.
 */
export interface IEnvironmentMeta {
    /** Absolute path to the directory for the environment */
    path: string;
    /** Name of the environment */
    name: string;
    /** The subdomain assigned to the environment */
    subdomain?: string;
    /** True if the environment has been fully configured; false if partially deployed */
    deployed: boolean;
    /** Optional AWS profile for the environment */
    awsProfile?: string;
}

/**
 * Discovers all Panfactum environments in the repository
 * 
 * @remarks
 * This function scans the environments directory for all subdirectories
 * containing an `environment.yaml` file. For each environment found:
 * 
 * 1. Reads the environment configuration file
 * 2. Extracts the environment name (from config or directory name)
 * 3. Determines if the environment is fully deployed
 * 4. Collects metadata like subdomain and AWS profile
 * 
 * The function gracefully handles missing or invalid environment files
 * by wrapping errors with context about which environment failed.
 * 
 * @param context - Panfactum context for configuration access
 * @returns Array of environment metadata objects
 * 
 * @example
 * ```typescript
 * const environments = await getEnvironments(context);
 * 
 * // Find production environment
 * const prod = environments.find(env => env.name === 'production');
 * if (prod?.deployed) {
 *   console.log(`Production is at ${prod.path}`);
 * }
 * 
 * // List all deployed environments
 * const deployed = environments.filter(env => env.deployed);
 * console.log(`${deployed.length} environments are deployed`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to read or parse environment configuration files
 * 
 * @see {@link isEnvironmentDeployed} - For checking deployment status
 * @see {@link getConfigValuesFromFile} - For reading environment config
 */
export async function getEnvironments(context: PanfactumContext): Promise<Array<IEnvironmentMeta>> {
    const glob = new Glob("*/environment.yaml");
    return asyncIterMap(glob.scan({ cwd: context.devshellConfig.environments_dir }), async path => {
        const filePath = join(context.devshellConfig.environments_dir, path)
        const envPath = dirname(filePath);
        try {
            const { environment, environment_subdomain: subdomain, aws_profile: awsProfile } = await getConfigValuesFromFile({ filePath, context }) || {}
            const name = environment ?? basename(envPath);

            return {
                name,
                path: envPath,
                subdomain,
                deployed: await isEnvironmentDeployed({ context, environment: name }),
                awsProfile
            }
        } catch (e) {
            throw new CLIError("Unable to get environments", e)
        }
    })
}