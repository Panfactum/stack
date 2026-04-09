// This command releases stuck Terraform/OpenTofu state locks from DynamoDB
// It helps recover from interrupted infrastructure operations

import { Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { deleteIaCStateLocks } from '@/util/terragrunt/deleteIaCStateLocks';

/**
 * Command for releasing stuck Terraform/OpenTofu state locks
 *
 * @remarks
 * This command helps recover from situations where Terraform/OpenTofu
 * operations are interrupted and leave state locks in DynamoDB. It:
 *
 * - Scans the DynamoDB lock table for active locks
 * - Filters locks by the specified owner
 * - Deletes matching locks to allow operations to proceed
 *
 * Key features:
 * - Automatic configuration detection from context
 * - User-specific lock filtering
 * - Batch deletion of multiple locks
 * - Safe operation (only deletes locks for specified user)
 *
 * Lock identification:
 * - Default: Uses current username@hostname
 * - Custom: Can specify any lock owner pattern
 * - Parses lock metadata to match owner
 *
 * Common scenarios:
 * - Terraform process killed or crashed
 * - Network interruption during apply
 * - CI/CD pipeline timeout
 * - Manual operation cancellation
 *
 * Prerequisites:
 * - DynamoDB table with Terraform locks
 * - AWS credentials with table access
 * - Valid Panfactum configuration
 *
 * Safety considerations:
 * - Only releases locks for specified user
 * - Verify no active operations before use
 * - Can cause state corruption if misused
 *
 * @example
 * ```bash
 * # Release your own locks (default)
 * pf iac delete-locks
 *
 * # Release locks for specific user
 * pf iac delete-locks --who "jenkins@ci-server"
 *
 * # Use specific profile and table
 * pf iac delete-locks --profile production --table prod-tf-locks
 *
 * # Specify all parameters
 * pf iac delete-locks --profile dev --table dev-locks --region us-west-2 --who "alice@laptop"
 * ```
 *
 * @see {@link deleteIaCStateLocks} - Shared implementation used by this command
 *   and the apply-abort cleanup path in `terragruntApply`.
 */
export default class DeleteLocksCommand extends PanfactumCommand {
  static override paths = [['iac', 'delete-locks']];

  static override usage = PanfactumCommand.Usage({
    description: 'Release all Terraform/OpenTofu state locks held by a user',
    category: 'Infrastructure as Code',
    details: `
Releases stuck Terraform/OpenTofu state locks from DynamoDB.

This command helps recover when infrastructure operations are interrupted,
leaving locks that prevent further changes. It safely removes only locks
owned by the specified user.

Configuration is automatically detected from the current directory's
Panfactum settings, but can be overridden with command options.

WARNING: Only use when you're certain no operations are running.
Releasing active locks can cause state corruption.
    `,
    examples: [
      ['Release all your locks using defaults', 'pf iac delete-locks'],
      ['Release locks for specific user', 'pf iac delete-locks --who "john@workstation"'],
      ['Use specific AWS profile and table', 'pf iac delete-locks --profile prod --table my-locks'],
    ],
  });

  /**
   * AWS profile for DynamoDB access
   *
   * @remarks
   * Defaults to tf_state_profile from Panfactum configuration.
   * Must have permissions to scan and delete items in the lock table.
   */
  profile = Option.String('--profile', {
    description: 'AWS profile to use (defaults to tf_state_profile from config)',
  });

  /**
   * DynamoDB table name containing locks
   *
   * @remarks
   * Defaults to tf_state_lock_table from configuration.
   * This is the table created by Panfactum's state backend setup.
   */
  table = Option.String('--table', {
    description: 'DynamoDB lock table name (defaults to tf_state_lock_table from config)',
  });

  /**
   * AWS region where lock table resides
   *
   * @remarks
   * Defaults to tf_state_region from configuration.
   * Must match the region where your state backend is configured.
   */
  region = Option.String('--region', {
    description: 'AWS region where lock table is located (defaults to tf_state_region from config)',
  });

  /**
   * Lock owner identifier to match
   *
   * @remarks
   * Defaults to current username@hostname format.
   * This string is matched against the 'Who' field in lock metadata.
   */
  who = Option.String('--who', {
    description: 'Owner of locks to release (defaults to $(whoami)@$(hostname))',
  });

  /**
   * Executes the lock deletion process
   *
   * @remarks
   * Delegates to {@link deleteIaCStateLocks}, which:
   *   1. Loads configuration from current directory
   *   2. Determines parameters (options override config)
   *   3. Validates required parameters
   *   4. Verifies AWS credentials
   *   5. Scans DynamoDB table for all locks
   *   6. Filters locks by owner
   *   7. Deletes matching locks in parallel
   *
   * @returns Exit code (0 for success)
   *
   * @throws {@link CLIError}
   * Throws when required configuration is missing or AWS operations fail
   */
  override async execute(): Promise<number> {
    await deleteIaCStateLocks({
      context: this.context,
      directory: process.cwd(),
      profile: this.profile,
      table: this.table,
      region: this.region,
      who: this.who,
    });
    return 0;
  }
}
