// This file defines Zod schemas for Terragrunt module status tracking
// These schemas ensure consistent status file formats across the system

import { z } from "zod"

/**
 * Schema for module initialization status
 * 
 * @remarks
 * Tracks the state of Terragrunt init operations:
 * - **uninited**: Module has never been initialized
 * - **running**: Initialization is currently in progress
 * - **success**: Last initialization completed successfully
 * - **error**: Last initialization failed
 * 
 * This status helps determine if a module needs initialization
 * before deployment operations can proceed.
 * 
 * @example
 * ```typescript
 * const status = INIT_STATUS_SCHEMA.parse("success");
 * if (status === "uninited" || status === "error") {
 *   console.log("Module needs initialization");
 * }
 * ```
 */
export const INIT_STATUS_SCHEMA = z.enum(["uninited", "running", "success", "error"])
  .describe("Terragrunt module initialization status")

/**
 * Schema for module deployment status
 * 
 * @remarks
 * Tracks the state of Terragrunt apply operations:
 * - **undeployed**: Module has never been deployed
 * - **running**: Deployment is currently in progress
 * - **success**: Last deployment completed successfully
 * - **error**: Last deployment failed
 * 
 * This status is critical for:
 * - Preventing concurrent deployments
 * - Tracking deployment failures
 * - Determining if resources exist
 * - Planning update operations
 * 
 * @example
 * ```typescript
 * const status = DEPLOY_STATUS_SCHEMA.parse("error");
 * if (status === "error") {
 *   console.log("Previous deployment failed, manual intervention may be needed");
 * }
 * ```
 */
export const DEPLOY_STATUS_SCHEMA = z.enum(["undeployed", "running", "success", "error"])
  .describe("Terragrunt module deployment status")

/**
 * Schema for module status file contents
 * 
 * @remarks
 * Defines the structure of the module.status.yaml file that tracks:
 * - Initialization state of the module
 * - Deployment state of the module
 * 
 * The file is created/updated after each Terragrunt operation to
 * maintain state between CLI invocations. Default values ensure
 * new modules start in the correct state.
 * 
 * The strict() modifier ensures no extra fields are accepted,
 * maintaining file format consistency.
 * 
 * @example
 * ```typescript
 * const statusData = MODULE_STATUS_FILE_SCHEMA.parse({
 *   init_status: "success",
 *   deploy_status: "running"
 * });
 * 
 * // Write to file
 * await writeFile('module.status.yaml', stringify(statusData));
 * ```
 * 
 * @see {@link getModuleStatus} - Reads and validates status files
 * @see {@link updateModuleStatus} - Updates status file contents
 */
export const MODULE_STATUS_FILE_SCHEMA = z.object({
    /** Current initialization status of the module */
    init_status: INIT_STATUS_SCHEMA.default("uninited")
      .describe("Module initialization status"),
    /** Current deployment status of the module */
    deploy_status: DEPLOY_STATUS_SCHEMA.default("undeployed")
      .describe("Module deployment status")
}).strict()
  .describe("Terragrunt module status file schema")
