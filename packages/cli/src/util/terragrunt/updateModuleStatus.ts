// This file provides utilities for updating Terragrunt module status files
// It tracks initialization and deployment states for modules

import { join } from "node:path"
import { CLIError } from "@/util/error/error";
import { directoryExists } from "@/util/fs/directoryExist";
import { fileExists } from "@/util/fs/fileExists";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import { MODULE_STATUS_FILE } from "./constants";
import { MODULE_STATUS_FILE_SCHEMA, type DEPLOY_STATUS_SCHEMA, type INIT_STATUS_SCHEMA } from "./schemas"
import type { PanfactumContext } from "@/util/context/context";
import type { z } from "zod"

/**
 * Input parameters for updating module status
 */
interface IUpdateModuleStatusInput {
    /** Full path to the module directory */
    moduleDirectory: string;
    /** Panfactum context for configuration */
    context: PanfactumContext;
    /** New initialization status (optional) */
    initStatus?: z.infer<typeof INIT_STATUS_SCHEMA>;
    /** New deployment status (optional) */
    deployStatus?: z.infer<typeof DEPLOY_STATUS_SCHEMA>;
}

/**
 * Updates the status file for a Terragrunt module
 * 
 * @remarks
 * This function maintains the module.status.yaml file that tracks:
 * - Initialization status (uninited, running, success, error)
 * - Deployment status (undeployed, running, success, error)
 * 
 * The function performs several validations:
 * 1. Ensures the module directory exists
 * 2. Verifies terragrunt.hcl is present (indicates valid module)
 * 3. Preserves existing status values when only updating one field
 * 
 * Status updates are atomic - the entire file is rewritten to ensure
 * consistency. This prevents partial updates that could leave the
 * status file in an invalid state.
 * 
 * Common usage patterns:
 * - Set status to "running" before operations
 * - Update to "success" or "error" after completion
 * - Query status before starting new operations
 * 
 * @param input - Parameters including directory and new status values
 * 
 * @example
 * ```typescript
 * // Mark initialization as running
 * await updateModuleStatus({
 *   moduleDirectory: '/environments/prod/us-east-1/aws_vpc',
 *   context,
 *   initStatus: 'running'
 * });
 * 
 * // After successful deployment
 * await updateModuleStatus({
 *   moduleDirectory: '/environments/prod/us-east-1/aws_vpc',
 *   context,
 *   initStatus: 'success',
 *   deployStatus: 'success'
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when the module directory doesn't exist
 * 
 * @throws {@link CLIError}
 * Throws when terragrunt.hcl is missing from the module directory
 * 
 * @see {@link getModuleStatus} - For reading current module status
 * @see {@link MODULE_STATUS_FILE} - The status file name constant
 * @see {@link MODULE_STATUS_FILE_SCHEMA} - Schema for status validation
 */
export async function updateModuleStatus(input: IUpdateModuleStatusInput): Promise<void> {
    const { initStatus, deployStatus, moduleDirectory, context } = input;

    if (! await directoryExists({ path: moduleDirectory })) {
        throw new CLIError(`Cannot update the status of a module with non-existant directory ${moduleDirectory}`)
    } else if (! await fileExists({ filePath: join(moduleDirectory, "terragrunt.hcl") })) {
        throw new CLIError(`${moduleDirectory} does not have the appropriate terragrunt.hcl configuration`)
    }

    const filePath = join(moduleDirectory, MODULE_STATUS_FILE)
    const existingStatus = await readYAMLFile({ context, filePath, validationSchema: MODULE_STATUS_FILE_SCHEMA })

    if (existingStatus) {
        const newStatus = existingStatus;
        if (initStatus) {
            newStatus.init_status = initStatus
        }

        if (deployStatus) {
            newStatus.deploy_status = deployStatus
        }
        await writeYAMLFile({ values: newStatus, overwrite: true, filePath, context })
    } else {
        await writeYAMLFile({
            values: {
                init_status: initStatus,
                deploy_status: deployStatus
            },
            overwrite: true,
            filePath,
            context
        })
    }
}