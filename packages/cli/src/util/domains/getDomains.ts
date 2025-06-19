import { join, dirname } from "node:path";
import { Glob } from "bun";
import { asyncIterMap } from "@/util/asyncIterMap";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { isEnvironmentDeployed } from "@/util/config/isEnvironmentDeployed";
import { CLIError } from "@/util/error/error";
import type { DomainConfigs } from "./tasks/types";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Finds all environment.yaml files in the environments directory, extracts domains data,
 * and merges them into a single object.
 * 
 * @param inputs - Object containing the context
 * @returns A record of domain names to their configuration (DomainConfigs)
 */
export async function getDomains(inputs: { context: PanfactumContext }): Promise<DomainConfigs> {
    const { context } = inputs;
    const environmentsDir = context.repoVariables.environments_dir;

    // Create a glob pattern to find all environment.yaml files in any subdirectory
    const glob = new Glob("**/environment.yaml");

    // Initialize the result object
    const domainConfigs: DomainConfigs = {};

    // Process all found environment.yaml files
    await asyncIterMap(
        glob.scan({ cwd: environmentsDir }),
        async (path) => {
            const filePath = join(environmentsDir, path);
            const envPath = dirname(filePath);

            const { environment, environment_dir: envDir, domains } = await getPanfactumConfig({
                context,
                directory: envPath,
            });


            // If domains exist in this environment.yaml, add them to our results
            if (domains) {
                if (!environment) {
                    throw new CLIError("Unknown environment")
                }
                if (!envDir) {
                    throw new CLIError("Unknown environment_dir")
                }
                const deployed = await isEnvironmentDeployed({ context, environment })
                Object.entries(domains).forEach(([domain, config]) => {
                    domainConfigs[domain] = {
                        domain,
                        zoneId: config.zone_id,
                        recordManagerRoleARN: config.record_manager_role_arn,
                        env: {
                            name: environment,
                            path: envDir,
                            deployed
                        }
                    };
                });
            }
        }
    );

    return domainConfigs;
}