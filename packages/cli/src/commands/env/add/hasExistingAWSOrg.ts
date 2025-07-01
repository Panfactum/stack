// This file provides utilities for determining existing AWS Organization status
// It helps identify whether users already have AWS Organizations configured

import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for checking existing AWS Organization status
 */
interface IHasExistingAWSOrgInput {
  /** Panfactum context for logging and user interaction */
  context: PanfactumContext;
}

/**
 * Determines whether user has an existing AWS Organization
 * 
 * @remarks
 * This function helps identify users who already have AWS Organizations
 * set up and configured. This information is crucial for determining
 * the appropriate installation path and configuration approach.
 * 
 * **Existing Organization Scenarios:**
 * - Multi-account setup with centralized management
 * - Service Control Policies (SCPs) already in place
 * - Existing cross-account roles and permissions
 * - Consolidated billing and cost management
 * - Established compliance and governance policies
 * 
 * **No Organization Scenarios:**
 * - Single AWS account usage
 * - Multiple accounts without centralized management
 * - New AWS setup without organization structure
 * - Migration from other cloud providers
 * 
 * The function provides clear guidance and documentation links to help
 * users understand AWS Organizations and make informed decisions about
 * their configuration approach.
 * 
 * @param input - Configuration including context for user interaction
 * @returns Promise resolving to true if user has existing AWS Organization
 * 
 * @example
 * ```typescript
 * // Check for existing AWS Organization
 * const hasOrg = await hasExistingAWSOrg({ context });
 * if (hasOrg) {
 *   // Use existing organization configuration path
 * } else {
 *   // Create new organization or use standalone setup
 * }
 * ```
 * 
 * @see {@link PanfactumContext} - For user interaction utilities
 * @see {@link https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html} - AWS Organizations documentation
 */
export async function hasExistingAWSOrg({ context }: IHasExistingAWSOrgInput): Promise<boolean> {
  return context.logger.select({
    explainer: `
        Do you have existing AWS accounts managed by an AWS Organization?
        
        If you aren't sure, see these docs: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html
    `,
    message: "Already using an AWS Organization?",
    choices: [
      {
        name: "Yes",
        description: "You have existing accounts managed by an AWS Organization.",
        value: true,
      },
      {
        name: "No",
        description: "You do not have existing accounts or they are not managed by an AWS Organization.",
        value: false,
      }
    ],
    default: true,
  });
}