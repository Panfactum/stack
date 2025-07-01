// This file provides utilities for determining AWS Organization creation preferences
// It guides users through the decision process for automated account management

import pc from "picocolors";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for determining AWS Organization creation preference
 */
interface IShouldCreateAWSOrgInput {
  /** Panfactum context for logging and user interaction */
  context: PanfactumContext;
}

/**
 * Determines whether user wants Panfactum to create an AWS Organization
 * 
 * @remarks
 * This function helps users decide whether to leverage Panfactum's automated
 * AWS Organization creation and management capabilities. The choice significantly
 * impacts the installation process and ongoing infrastructure management.
 * 
 * **Automated Organization Benefits:**
 * - Full automation of AWS account provisioning
 * - Seamless integration with Panfactum workflows
 * - Consistent security and compliance policies
 * - Simplified cross-account access management
 * - Built-in Service Control Policies (SCPs)
 * 
 * **Manual Organization Considerations:**
 * - Requires advanced AWS expertise
 * - May not be fully compatible with automated installers
 * - Additional manual configuration required
 * - Potential compatibility issues with Panfactum modules
 * 
 * The function presents clear options with warnings about compatibility
 * implications for manual organization management.
 * 
 * @param input - Configuration including context for user interaction
 * @returns Promise resolving to true if user wants automated organization creation
 * 
 * @example
 * ```typescript
 * // Determine organization creation preference
 * const shouldCreate = await shouldCreateAWSOrg({ context });
 * if (shouldCreate) {
 *   // Proceed with automated organization setup
 * } else {
 *   // Use manual organization configuration
 * }
 * ```
 * 
 * @see {@link PanfactumContext} - For user interaction utilities
 */
export async function shouldCreateAWSOrg({ context }: IShouldCreateAWSOrgInput): Promise<boolean> {
  return context.logger.select({
    explainer: `
      We recommend letting Panfactum create an AWS Organization to fully automate the environment
      intallation process and ensure maximum compatibility with the Panfactum framework.
    `,
    message: `Would you like to create an AWS Organization?`,
    choices: [
      {
        name: "Yes:  Use Panfactum to automate AWS account management.",
        value: true,
      },
      {
        name: `No:   I am an expert. ${pc.yellow("(WARNING: may not be fully compatible with automated installers)")}`,
        value: false,
      }
    ],
    default: true,
  });
}