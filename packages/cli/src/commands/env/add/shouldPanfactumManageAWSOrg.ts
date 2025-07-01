// This file provides utilities for determining Panfactum AWS Organization management preferences
// It guides users through decisions about automated organization configuration

import pc from "picocolors";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for determining Panfactum organization management preference
 */
interface IShouldPanfactumManageAWSOrgInput {
  /** Panfactum context for logging and user interaction */
  context: PanfactumContext;
}

/**
 * Determines whether user wants Panfactum to manage their AWS Organization
 * 
 * @remarks
 * This function helps users decide whether to allow Panfactum to configure
 * and manage their existing AWS Organization. This choice affects account
 * provisioning, cross-account roles, and organizational policies.
 * 
 * **Panfactum Management Benefits:**
 * - Automated account creation for new environments
 * - Consistent cross-account role configuration
 * - Integrated Service Control Policies (SCPs)
 * - Seamless environment provisioning workflow
 * - Built-in compliance and security policies
 * 
 * **Manual Management Considerations:**
 * - Requires advanced AWS Organization expertise
 * - May not be fully compatible with automated installers
 * - Manual account provisioning for new environments
 * - Custom role and policy configuration required
 * - Potential integration issues with Panfactum workflows
 * 
 * The function presents clear options with warnings about compatibility
 * implications for manual organization management.
 * 
 * @param input - Configuration including context for user interaction
 * @returns Promise resolving to true if user wants Panfactum to manage organization
 * 
 * @example
 * ```typescript
 * // Determine organization management preference
 * const shouldManage = await shouldPanfactumManageAWSOrg({ context });
 * if (shouldManage) {
 *   // Configure Panfactum organization management
 * } else {
 *   // Use manual organization configuration
 * }
 * ```
 * 
 * @see {@link PanfactumContext} - For user interaction utilities
 */
export async function shouldPanfactumManageAWSOrg({ context }: IShouldPanfactumManageAWSOrgInput): Promise<boolean> {
  return context.logger.select({
    explainer: `
    We recommend using Panfactum to manage your AWS organization to automate the account creation process
    for new environments and ensure maximum compatibility with Panfactum installations.
    `,
    message: `Would you like to allow Panfactum to configure your AWS Organization?`,
    choices: [
      {
        name: "Yes",
        value: true,
        description: "Use Panfactum to simplify AWS account management."
      },
      {
        name: `No`,
        value: false,
        description: `For experts only. ${pc.yellow("(WARNING: may not be fully compatible with automated installers)")}`
      }
    ],
    default: true,
  });
}