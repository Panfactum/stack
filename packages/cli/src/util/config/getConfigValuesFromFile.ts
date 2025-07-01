// This file provides utilities for reading configuration values from Panfactum config files
// It supports reading from various levels (global, environment, region, module) and handles encrypted files

import { join } from "node:path"
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { getEnvironments } from "./getEnvironments";
import { getRegions } from "./getRegions";
import { PANFACTUM_CONFIG_SCHEMA, type TGConfigFile } from "./schemas";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Base configuration input shared by all config types
 */
interface IBaseConfigInput {
    /** Whether to read from encrypted (.secret.yaml) file */
    secret?: boolean;
    /** Panfactum context for configuration access */
    context: PanfactumContext;
}

/**
 * Configuration input using direct file path
 */
interface IFilepathConfigInput extends IBaseConfigInput {
    /** Direct path to the configuration file */
    filePath: string;
}

/**
 * Configuration input for environment-level config
 */
interface IEnvironmentConfigInput extends IBaseConfigInput {
    /** Environment name to read config from */
    environment: string;
}

/**
 * Configuration input for region-level config
 */
interface IRegionConfigInput extends IEnvironmentConfigInput {
    /** Region name within the environment */
    region: string;
}

/**
 * Configuration input for module-level config
 */
interface IModuleConfigInput extends IRegionConfigInput {
    /** Module name within the region */
    module: string;
}

/**
 * Union type for all configuration input variants
 */
type ConfigInput =
    | IEnvironmentConfigInput
    | IRegionConfigInput
    | IModuleConfigInput
    | IFilepathConfigInput;

/**
 * Reads configuration values from Panfactum YAML files at various hierarchy levels
 * 
 * @remarks
 * This function supports reading configuration from multiple levels of the
 * Panfactum hierarchy:
 * - Global: `environments/global.yaml`
 * - Environment: `environments/{env}/environment.yaml`
 * - Region: `environments/{env}/{region}/region.yaml`
 * - Module: `environments/{env}/{region}/{module}/module.yaml`
 * - Direct path: Any specified file path
 * 
 * Each level can have an encrypted variant with `.secret.yaml` extension.
 * Encrypted files are decrypted using SOPS before parsing.
 * 
 * The function returns null if the specified environment, region, or module
 * doesn't exist, allowing graceful handling of missing configurations.
 * 
 * @param input - Configuration specifying which file to read
 * @returns Parsed configuration object or null if not found
 * 
 * @example
 * ```typescript
 * // Read module-level config
 * const moduleConfig = await getConfigValuesFromFile({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
 *   module: 'vpc',
 *   secret: false
 * });
 * 
 * // Read encrypted environment config
 * const envSecrets = await getConfigValuesFromFile({
 *   context,
 *   environment: 'staging',
 *   secret: true
 * });
 * 
 * // Read from specific path
 * const customConfig = await getConfigValuesFromFile({
 *   context,
 *   filePath: '/path/to/config.yaml'
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when file exists but cannot be read or parsed
 * 
 * @throws {@link PanfactumZodError}
 * Throws when file content doesn't match the expected schema
 * 
 * @see {@link PANFACTUM_CONFIG_SCHEMA} - Schema for validating config files
 * @see {@link sopsDecrypt} - For decrypting secret files
 * @see {@link readYAMLFile} - For reading plain YAML files
 */
export async function getConfigValuesFromFile(input: ConfigInput): Promise<TGConfigFile | null> {
    const { secret, context } = input;

    const suffix = secret ? ".secret.yaml" : ".yaml"
    let filePath;
    if ("filePath" in input) {
        filePath = input.filePath;
    } else if ("module" in input) {
        const { environment, region, module } = input;
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            return null
        }
        const regionMeta = (await getRegions(context, envMeta.path)).find(r => r.name === region)
        if (!regionMeta) {
            return null
        }
        filePath = join(regionMeta.path, module, `module${suffix}`)
    } else if ("region" in input) {
        const { environment, region } = input;
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            return null
        }
        const regionMeta = (await getRegions(context, envMeta.path)).find(r => r.name === region)
        if (!regionMeta) {
            return null
        }
        filePath = join(regionMeta.path, `region${suffix}`)
    } else if ("environment" in input) {
        const { environment } = input;
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            return null
        }
        filePath = join(envMeta.path, `environment${suffix}`)
    } else {
        filePath = join(context.repoVariables.environments_dir, `global${suffix}`)
    }

    return secret ?
        sopsDecrypt({
            context,
            filePath,
            throwOnMissing: false,
            validationSchema: PANFACTUM_CONFIG_SCHEMA
        }) :
        readYAMLFile({
            context,
            filePath,
            throwOnEmpty: false,
            throwOnMissing: false,
            validationSchema: PANFACTUM_CONFIG_SCHEMA,
        });
}
