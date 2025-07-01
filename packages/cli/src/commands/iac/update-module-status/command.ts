// This command updates the deployment status tracking for IaC modules
// It's used internally by the framework to track module state

import { Command, Option } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { PanfactumZodError } from "@/util/error/error";
import { DEPLOY_STATUS_SCHEMA, INIT_STATUS_SCHEMA } from "@/util/terragrunt/schemas";
import { updateModuleStatus } from "@/util/terragrunt/updateModuleStatus";

/**
 * Command for updating IaC module deployment status
 * 
 * @remarks
 * This command updates the `.pf.yaml` status file that tracks the
 * deployment state of Terragrunt modules. It's primarily used internally
 * by the Panfactum framework to:
 * 
 * - Track initialization status (pending, success, error)
 * - Track deployment status (pending, success, error)
 * - Enable checkpointing for resumable operations
 * - Provide status visibility to other commands
 * 
 * Status tracking enables:
 * - Resumable cluster installations
 * - Deployment progress monitoring
 * - Error state detection
 * - Skip logic for completed modules
 * 
 * The command updates specific fields without overwriting
 * the entire status file, preserving other metadata.
 * 
 * Status values:
 * - **pending**: Operation not yet attempted
 * - **success**: Operation completed successfully
 * - **error**: Operation failed
 * 
 * Typical workflow:
 * 1. Set init status to 'pending' before terraform init
 * 2. Update to 'success' or 'error' after init
 * 3. Set deploy status to 'pending' before apply
 * 4. Update to 'success' or 'error' after apply
 * 
 * @example
 * ```bash
 * # Update init status to success
 * pf iac update-module-status -m ./aws_vpc -i success
 * 
 * # Update deploy status to error
 * pf iac update-module-status -m ./aws_vpc -d error
 * 
 * # Update both statuses
 * pf iac update-module-status -m ./kube_vault -i success -d pending
 * ```
 * 
 * @see {@link updateModuleStatus} - Core status update logic
 * @see {@link getModuleStatus} - For reading module status
 */
export class UpdateModuleStatusCommand extends PanfactumCommand {
  static override paths = [["iac", "update-module-status"]];

  static override usage = Command.Usage({
    description: "Updates the local status file for a particular IaC module",
    category: 'Infrastructure as Code',
    details: `
Updates the deployment status tracking for Terragrunt modules.

This command modifies the .pf.yaml file in the specified module directory
to track initialization and deployment status. It's primarily used internally
by Panfactum commands to enable resumable operations.

Status values:
• pending - Operation not yet attempted
• success - Operation completed successfully  
• error   - Operation failed
    `,
    examples: [
      [
        'Update init status',
        'pf iac update-module-status --module-directory ./aws_vpc --init-status success'
      ],
      [
        'Update deploy status', 
        'pf iac update-module-status -m ./kube_vault -d error'
      ],
      [
        'Update both statuses',
        'pf iac update-module-status -m ./aws_eks -i success -d pending'
      ]
    ]
  });

  /**
   * Directory path to the module to update
   * 
   * @remarks
   * Must be a valid Terragrunt module directory containing
   * or capable of containing a .pf.yaml status file.
   */
  directory: string = Option.String("--module-directory,-m", {
    description: "The directory of the module whose status will be updated",
    arity: 1,
    required: true
  });

  /**
   * New initialization status value
   * 
   * @remarks
   * Updates the init_status field in .pf.yaml.
   * Must be one of: pending, success, error.
   */
  initStatus: string | undefined = Option.String("--init-status,-i", {
    description: "The updated 'initStatus': pending, success, error",
    arity: 1
  });

  /**
   * New deployment status value
   * 
   * @remarks
   * Updates the deploy_status field in .pf.yaml.
   * Must be one of: pending, success, error.
   */
  deployStatus: string | undefined = Option.String("--deploy-status,-d", {
    description: "The updated 'deployStatus': pending, success, error",
    arity: 1
  });

  /**
   * Executes the status update operation
   * 
   * @remarks
   * This method:
   * 1. Validates the provided status values against schemas
   * 2. Calls updateModuleStatus to modify the .pf.yaml file
   * 3. Only updates fields that were specified (partial update)
   * 
   * The validation ensures only valid status values are written,
   * preventing corruption of the status tracking system.
   * 
   * @throws {@link PanfactumZodError}
   * Throws when status values don't match the allowed values
   */
  async execute() {
    const { context, directory } = this;
    const { initStatus, deployStatus } = this;

    let validatedInitStatus;
    if (initStatus) {
      const parseResult = INIT_STATUS_SCHEMA.safeParse(initStatus);
      if (!parseResult.success) {
        throw new PanfactumZodError("Invalid value for --init-status/-i", "--init-status/-i", parseResult.error);
      }
      validatedInitStatus = parseResult.data;
    }

    let validatedDeployStatus;
    if (deployStatus) {
      const parseResult = DEPLOY_STATUS_SCHEMA.safeParse(deployStatus);
      if (!parseResult.success) {
        throw new PanfactumZodError("Invalid value for --deploy-status/-d", "--deploy-status/-d", parseResult.error);
      }
      validatedDeployStatus = parseResult.data;
    }

    await updateModuleStatus({ context, initStatus: validatedInitStatus, deployStatus: validatedDeployStatus, moduleDirectory: directory })
  }
}