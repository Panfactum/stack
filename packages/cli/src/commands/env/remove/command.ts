// This command is a placeholder for future environment removal functionality
// Currently provides guidance on manual environment cleanup

import { Command } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";

/**
 * Command for removing Panfactum environments (not yet implemented)
 * 
 * @remarks
 * This command is a placeholder for future functionality to remove
 * Panfactum environments and their associated AWS resources. When
 * implemented, it will handle:
 * 
 * - Safe destruction of all environment resources
 * - AWS account closure or cleanup
 * - Removal of IaC configuration
 * - State file cleanup
 * - Profile removal
 * 
 * Current status:
 * - Command structure is in place
 * - Actual removal logic not implemented
 * - Refers users to aws-nuke for manual cleanup
 * 
 * The complexity of safely removing environments includes:
 * - Ensuring no cross-environment dependencies
 * - Handling AWS Organization constraints
 * - Preserving audit trails
 * - Managing backup retention
 * 
 * Until this command is implemented, users must:
 * 1. Manually destroy all Terraform resources
 * 2. Use aws-nuke for comprehensive cleanup
 * 3. Close AWS accounts through console
 * 4. Remove local configuration files
 * 
 * @example
 * ```bash
 * # Not yet functional
 * pf env remove
 * 
 * # Currently shows:
 * # "This command is not yet implemented"
 * # "Use 'aws-nuke' for manual cleanup"
 * ```
 * 
 * @throws {@link CLIError}
 * Always throws with "Command not implemented" message
 */
export class EnvironmentRemoveCommand extends PanfactumCommand {
    static override paths = [["env", "remove"]];

    static override usage = Command.Usage({
        description: "Destroys an environment and all infrastructure contained in it",
        category: 'Environment',
        details: `
Removes a Panfactum environment and all associated resources.

WARNING: This command is not yet implemented.

For manual environment removal:
1. Destroy all Terraform-managed resources
2. Use aws-nuke to clean up remaining AWS resources
3. Close the AWS account if no longer needed
4. Remove local environment configuration
        `,
        examples: [
            [
                "Remove environment (not implemented)",
                "pf env remove"
            ]
        ]
    });

    /**
     * Executes the environment removal command
     * 
     * @remarks
     * Currently displays a warning message explaining that the
     * command is not implemented and suggests using aws-nuke
     * for manual resource cleanup.
     * 
     * @throws {@link CLIError}
     * Always throws with "Command not implemented" message
     */
    async execute() {
        this.context.logger.warn(`
            This command is not yet implemented.

            However, the DevShell comes with 'aws-nuke' which can be used
            to delete all AWS resources.
        `)
        throw new CLIError("Command not implemented.")
    }
}