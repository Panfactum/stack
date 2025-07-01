// This file provides utilities for updating Panfactum configuration files
// It supports both plain and encrypted (SOPS) YAML files at various hierarchy levels

import { join } from "node:path"
import { stringify } from "yaml";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import { getEnvironments } from "./getEnvironments";
import { getRegions } from "./getRegions";
import { CLIError } from "../error/error";
import { writeFile } from "../fs/writeFile";
import { sopsWrite } from "../sops/sopsWrite";
import type { TGConfigFile } from "./schemas";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Base input for all configuration update operations
 */
interface IBaseUpsertInput {
    /** Whether to write to encrypted (.secret.yaml) file */
    secret?: boolean;
    /** Panfactum context for configuration access */
    context: PanfactumContext;
    /** Configuration values to write/merge */
    values: TGConfigFile;
}

/**
 * Input for updating configuration at a specific file path
 */
interface IFilepathUpsertInput extends IBaseUpsertInput {
    /** Direct path to the configuration file */
    filePath: string;
}

/**
 * Input for updating environment-level configuration
 */
interface IEnvironmentUpsertInput extends IBaseUpsertInput {
    /** Environment name to update */
    environment: string;
}

/**
 * Input for updating region-level configuration
 */
interface IRegionUpsertInput extends IEnvironmentUpsertInput {
    /** Region name within the environment */
    region: string;
}

/**
 * Input for updating module-level configuration
 */
interface IModuleUpsertInput extends IRegionUpsertInput {
    /** Module name within the region */
    module: string;
}

/**
 * Union type for all configuration update variants
 */
type UpsertInput =
    | IEnvironmentUpsertInput
    | IRegionUpsertInput
    | IModuleUpsertInput
    | IFilepathUpsertInput;

/**
 * Updates configuration values in Panfactum YAML files
 * 
 * @remarks
 * This function performs intelligent merging of configuration values:
 * 
 * 1. Determines the correct file path based on the hierarchy level
 * 2. Reads existing configuration from the file (if it exists)
 * 3. Merges new values with existing ones:
 *    - Simple values are replaced
 *    - Objects like `extra_inputs`, `extra_tags`, and `domains` are deep merged
 * 4. Writes the result back to the file
 * 
 * The function handles both plain YAML files and encrypted files (using SOPS).
 * It automatically creates parent directories if they don't exist.
 * 
 * File naming convention:
 * - Global: `environments/global.yaml` or `global.secret.yaml`
 * - Environment: `environments/{env}/environment.yaml`
 * - Region: `environments/{env}/{region}/region.yaml`
 * - Module: `environments/{env}/{region}/{module}/module.yaml`
 * 
 * The function intelligently handles cases where environment/region/module
 * names don't match their directory names by looking up the actual paths.
 * 
 * @param input - Configuration specifying what and where to update
 * 
 * @example
 * ```typescript
 * // Update module configuration
 * await upsertConfigValues({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
 *   module: 'vpc',
 *   values: {
 *     extra_tags: {
 *       CostCenter: 'Engineering'
 *     }
 *   }
 * });
 * 
 * // Update encrypted environment config
 * await upsertConfigValues({
 *   context,
 *   environment: 'staging',
 *   secret: true,
 *   values: {
 *     aws_account_id: '987654321098',
 *     vault_token: 'secret-token'
 *   }
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to write configuration to the file system
 * 
 * @see {@link getConfigValuesFromFile} - For reading existing configuration
 * @see {@link sopsWrite} - For writing encrypted files
 * @see {@link writeFile} - For writing plain YAML files
 */
export async function upsertConfigValues(input: UpsertInput): Promise<void> {
    const { values, context, secret } = input;

    // Determine the file name to write to based on the
    // the inputs; note that this is a bit complicated
    // because the environment, region, and module names
    // don't necessarily have to match their directory names
    const suffix = secret ? ".secret.yaml" : ".yaml"
    let filePath;
    if ("filePath" in input) {
        filePath = input.filePath;
    } else if ("module" in input) {
        const { environment, region, module } = input;
        const fileName = `module${suffix}`
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            filePath = join(context.repoVariables.environments_dir, environment, region, module, fileName)
        } else {
            const regionMeta = (await getRegions(context, envMeta.path)).find(r => r.name === region)
            if (!regionMeta) {
                filePath = join(envMeta.path, region, module, fileName)
            } else {
                filePath = join(regionMeta.path, module, fileName)
            }
        }
    } else if ("region" in input) {
        const { environment, region } = input;
        const fileName = `region${suffix}`
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            filePath = join(context.repoVariables.environments_dir, environment, region, fileName)
        } else {
            const regionMeta = (await getRegions(context, envMeta.path)).find(r => r.name === region)
            if (!regionMeta) {
                filePath = join(envMeta.path, region, fileName)
            } else {
                filePath = join(regionMeta.path, fileName)
            }
        }
    } else if ("environment" in input) {
        const { environment } = input;
        const fileName = `environment${suffix}`
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            filePath = join(context.repoVariables.environments_dir, environment, fileName)
        } else {
            filePath = join(envMeta.path, fileName)
        }
    } else {
        filePath = join(context.repoVariables.environments_dir, `global${suffix}`)
    }

    // Get the existing values
    const existingValues = await getConfigValuesFromFile(input)


    // Merge the existing values with the new values
    // and write the results
    try {
        const newValues = existingValues ? {
            ...existingValues,
            ...values,
            extra_inputs: {
                ...existingValues.extra_inputs,
                ...values.extra_inputs
            },
            extra_tags: {
                ...existingValues.extra_tags,
                ...values.extra_tags
            },
            domains: {
                ...existingValues.domains,
                ...values.domains
            }
        } : values;

        if (secret) {
            await sopsWrite({
                filePath,
                values: newValues,
                context,
                overwrite: true
            })
        } else {
            await writeFile({
                filePath: filePath,
                contents: stringify(newValues, {
                    doubleQuotedAsJSON: true,
                }),
                context,
                overwrite: true
            })
        }
    } catch (e) {
        throw new CLIError(`Failed to write new config values to ${filePath}`, e)
    }

}