// This file provides utilities for determining module directory paths
// It constructs the full path to a module based on the environment hierarchy

import { join } from "node:path"
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for getting a module directory path
 */
interface IGetModuleDirectoryInput {
    /** Name of the environment containing the module */
    environment: string;
    /** Name of the region within the environment */
    region: string;
    /** Name of the module */
    module: string;
    /** Panfactum context for accessing repository variables */
    context: PanfactumContext;
}

/**
 * Constructs the full filesystem path to a Terragrunt module directory
 * 
 * @remarks
 * This function builds the standard Panfactum module path structure:
 * `{environments_dir}/{environment}/{region}/{module}`
 * 
 * The resulting path is where:
 * - Terragrunt configuration files are stored
 * - Terraform state references are maintained
 * - Module-specific configuration is placed
 * - Generated provider files are created
 * 
 * This standardized structure ensures:
 * - Consistent module organization across environments
 * - Clear separation between different deployment contexts
 * - Easy navigation and discovery of modules
 * 
 * @param input - Parameters specifying the module location
 * @returns Absolute path to the module directory
 * 
 * @example
 * ```typescript
 * const moduleDir = getModuleDirectory({
 *   environment: 'production',
 *   region: 'us-east-1',
 *   module: 'aws_vpc',
 *   context
 * });
 * // Returns: /home/user/repo/environments/production/us-east-1/aws_vpc
 * ```
 * 
 * @see {@link getModuleHash} - For computing module content hashes
 * @see {@link getModuleStatus} - For reading module deployment status
 */
export function getModuleDirectory(
    input: IGetModuleDirectoryInput
): string {
    const { environment, region, module, context } = input;
    return join(context.repoVariables.environments_dir, environment, region, module)
}