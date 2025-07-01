// This file provides utilities for validating AWS root user profiles
// It ensures that cluster operations are performed with appropriate permissions

import { CLIError } from '@/util/error/error';
import { getIdentity } from '../aws/getIdentity';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Input parameters for validating AWS root profile
 */
interface IValidateRootProfileInput {
  /** AWS profile name to validate */
  profile: string;
  /** Panfactum context for AWS operations */
  context: PanfactumContext;
}

/**
 * Validates that an AWS profile belongs to a root user account
 * 
 * @remarks
 * This function verifies that the provided AWS profile is associated with
 * a root user account, which is required for certain privileged operations
 * like EKS cluster management and infrastructure provisioning.
 * 
 * The validation process:
 * 1. Retrieves the caller identity using the profile
 * 2. Checks if the ARN contains 'root' designation
 * 3. Throws appropriate errors for invalid profiles
 * 
 * Root user validation is critical for:
 * - EKS cluster creation and management
 * - IAM policy and role management
 * - High-privilege infrastructure operations
 * - Security-sensitive AWS operations
 * 
 * @param input - Configuration including profile and context
 * 
 * @example
 * ```typescript
 * // Validate root profile before cluster operations
 * await validateRootProfile({
 *   profile: 'production-root',
 *   context
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Use in command validation
 * try {
 *   await validateRootProfile({ profile: awsProfile, context });
 *   // Proceed with privileged operations
 * } catch (error) {
 *   // Handle non-root profile error
 * }
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when the profile is not associated with a root user
 * 
 * @throws {@link CLIError}
 * Throws when AWS identity lookup fails
 * 
 * @see {@link getIdentity} - For retrieving AWS caller identity
 */
export async function validateRootProfile({ profile, context }: IValidateRootProfileInput): Promise<void> {
  try {
    const identity = await getIdentity({ context, profile });
    
    if (!identity.Arn || !identity.Arn.includes('root')) {
      throw new CLIError(`Provided profile is not the root user. Ensure that the aws profile set in your './kube/config.user.yaml' is for a root user.`);
    }
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    throw new CLIError('Unknown error occurred', { cause: error });
  }
}