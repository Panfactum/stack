// This file provides utilities for retrieving the deployment status of Terragrunt modules
// It checks for module existence and reads status from the module status file

import { join } from "node:path"
import { z } from "zod";
import { directoryExists } from "@/util/fs/directoryExist";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { MODULE_STATUS_FILE } from "./constants";
import { MODULE_STATUS_FILE_SCHEMA, type DEPLOY_STATUS_SCHEMA, type INIT_STATUS_SCHEMA } from "./schemas";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Complete status information for a Terragrunt module
 */
interface IModuleStatus {
    /** Whether the environment directory exists */
    environment_exists: boolean;
    /** Whether the region directory exists */
    region_exists: boolean;
    /** Whether the module directory exists */
    module_exists: boolean;
    /** Initialization status of the module */
    init_status: z.infer<typeof INIT_STATUS_SCHEMA>
    /** Deployment status of the module */
    deploy_status: z.infer<typeof DEPLOY_STATUS_SCHEMA>
}

/**
 * Input parameters for getting module status
 */
interface IGetModuleStatusInput {
    /** Name of the environment */
    environment: string;
    /** Name of the region */
    region: string;
    /** Name of the module */
    module: string;
    /** Panfactum context for configuration */
    context: PanfactumContext;
}

/**
 * Retrieves the current status of a Terragrunt module
 * 
 * @remarks
 * This function checks the deployment status of a module by:
 * 1. Verifying the existence of environment, region, and module directories
 * 2. Reading the module status file if it exists
 * 3. Returning appropriate default values if directories or files don't exist
 * 
 * The status information includes:
 * - **Directory existence**: Which parts of the hierarchy exist
 * - **Init status**: Whether Terragrunt init has been run
 * - **Deploy status**: Current deployment state (deployed, failed, etc.)
 * 
 * This function is essential for:
 * - Determining if a module needs initialization
 * - Checking if a module has been deployed
 * - Validating environment structure
 * - Planning deployment operations
 * 
 * @param input - Parameters specifying which module to check
 * @returns Complete status information for the module
 * 
 * @example
 * ```typescript
 * const status = await getModuleStatus({
 *   environment: 'production',
 *   region: 'us-east-1',
 *   module: 'aws_vpc',
 *   context
 * });
 * 
 * if (!status.module_exists) {
 *   console.log('Module directory needs to be created');
 * } else if (status.init_status === 'uninited') {
 *   console.log('Module needs initialization');
 * } else if (status.deploy_status === 'undeployed') {
 *   console.log('Module is ready for deployment');
 * }
 * ```
 * 
 * @see {@link MODULE_STATUS_FILE} - The status file name constant
 * @see {@link updateModuleStatus} - For updating module status after operations
 * @see {@link MODULE_STATUS_FILE_SCHEMA} - Schema for status file validation
 */
export async function getModuleStatus(
    input: IGetModuleStatusInput
): Promise<IModuleStatus> {

    const { context, environment, region, module } = input;
    const envDir = join(context.repoVariables.environments_dir, environment)
    const regionDir = join(envDir, region)
    const moduleDir = join(regionDir, module)

    if (!await directoryExists({ path: moduleDir })) {
        if (!await directoryExists({ path: regionDir })) {
            return {
                environment_exists: await directoryExists({ path: envDir }),
                region_exists: false,
                module_exists: false,
                init_status: "uninited",
                deploy_status: "undeployed"
            }
        } else {
            return {
                environment_exists: true,
                region_exists: true,
                module_exists: false,
                init_status: "uninited",
                deploy_status: "undeployed"
            }
        }
    }

    const moduleStatus = await readYAMLFile({
        context,
        filePath: join(moduleDir, MODULE_STATUS_FILE),
        throwOnEmpty: false,
        validationSchema: MODULE_STATUS_FILE_SCHEMA
    });

    if (moduleStatus) {
        return {
            environment_exists: true,
            region_exists: true,
            module_exists: true,
            ...moduleStatus
        }
    } else {
        return {
            environment_exists: true,
            region_exists: true,
            module_exists: true,
            init_status: "uninited",
            deploy_status: "undeployed"
        }
    }
}