// This file provides utilities for verifying access to AWS Organization management account
// It guides users through the authentication process for privileged operations

import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for checking management account access
 */
interface IHasAccessToManagementAccountInput {
  /** Panfactum context for logging and user interaction */
  context: PanfactumContext;
}

/**
 * Verifies that user has access to AWS Organization management account
 * 
 * @remarks
 * This function ensures that users have appropriate access to the AWS
 * Organization's management (root) account before proceeding with privileged
 * operations that require organization-level permissions.
 * 
 * The verification process:
 * 1. Displays information about required access level
 * 2. Prompts user to confirm they have logged into management account
 * 3. Continues prompting until access is confirmed
 * 4. Enables subsequent organization management operations
 * 
 * Management account access is required for:
 * - AWS Organization configuration
 * - Account provisioning and management
 * - Cross-account role setup
 * - Organization-wide policy enforcement
 * - Service Control Policy (SCP) management
 * 
 * @param input - Configuration including context for user interaction
 * 
 * @example
 * ```typescript
 * // Verify management account access before org setup
 * await hasAccessToManagementAccount({ context });
 * // Proceed with organization management operations
 * ```
 * 
 * @see {@link PanfactumContext} - For user interaction utilities
 */
export async function hasAccessToManagementAccount({ context }: IHasAccessToManagementAccountInput): Promise<void> {

  context.logger.info(`
    To allow Panfactum to properly configure your AWS Organization, you will need administrator access to your
    organization's management / root AWS account. Please log into the management account now.  
  `)

  while (true) {
    const confirmed = await context.logger.confirm({
      message: `Have you logged in?`,
      default: true
    });

    if (confirmed) {
      break
    } else {
      context.logger.error("You must login to the management account of your AWS organization to continue.")
    }
  }
}