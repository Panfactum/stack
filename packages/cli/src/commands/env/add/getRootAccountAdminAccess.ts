// This file provides utilities for obtaining admin access to AWS root account
// It guides users through credential retrieval for management account access

import { confirm } from "@inquirer/prompts";
import { getAdminAccessCredentials } from "./getAdminAccessCredentials";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for getting root account admin access
 */
interface IGetRootAccountAdminAccessInput {
  /** Panfactum context for logging and user interaction */
  context: PanfactumContext;
}

/**
 * Guides user through obtaining administrative access to AWS root account
 * 
 * @remarks
 * This function helps users provision and configure administrative credentials
 * for the AWS management account. This is a critical step in Panfactum
 * environment setup that ensures proper permissions for infrastructure
 * provisioning and management.
 * 
 * The process includes:
 * 1. Displaying instructions for credential provisioning
 * 2. Confirming user has obtained required credentials
 * 3. Collecting and validating the administrative credentials
 * 4. Verifying account access and permissions
 * 
 * Required permissions:
 * - AdministratorAccess policy attachment
 * - IAM user credentials in management account
 * - Valid access key and secret key pair
 * 
 * @param input - Configuration including context for user interaction
 * @returns Promise resolving to administrative access credentials
 * 
 * @example
 * ```typescript
 * // Obtain root account credentials during setup
 * const credentials = await getRootAccountAdminAccess({ context });
 * console.log(`Access Key: ${credentials.accessKeyId}`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when credential validation fails
 * 
 * @see {@link getAdminAccessCredentials} - For credential collection and validation
 */
export async function getRootAccountAdminAccess({ context }: IGetRootAccountAdminAccessInput) {
    context.logger.info(
        `
            To proceed, this installer needs AdministratorAccess to the management account for your AWS Organization.

            Please provision access keys for an IAM user in the management account with the AdministratorAccess policy attached.

            See our online documentation for more information. (TODO)
        `
    )

    while (true) {
        const ready = await confirm({
            message: `Have your retrieved those credentials?`
        });

        if (ready) {
            break;
        }

        context.logger.warn(
            "Ok. Follow the above guide to get those ready as you'll need them for the next steps."
        )
    }

    // TODO: Need to verify that this is the root account
    return getAdminAccessCredentials(context)
}