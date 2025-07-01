// This file provides a factory function for creating AWS Organizations clients
// It handles credential loading from files to work around AWS SDK issues

import { OrganizationsClient } from "@aws-sdk/client-organizations";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an Organizations client
 */
interface IGetOrganizationsClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client (default: us-east-1) */
  region?: string;
}

/**
 * Creates an AWS Organizations client with proper credential handling
 * 
 * @remarks
 * This function creates an OrganizationsClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
 * 
 * Note: AWS Organizations is a global service, so the region is always set to us-east-1
 * 
 * @param inputs - Configuration for the Organizations client
 * @returns Configured AWS Organizations client
 * 
 * @example
 * ```typescript
 * const orgClient = await getOrganizationsClient({
 *   context,
 *   profile: 'management'
 * });
 * 
 * const accounts = await orgClient.send(new ListAccountsCommand({}));
 * ```
 * 
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link OrganizationsClient} - AWS SDK Organizations client documentation
 */
export async function getOrganizationsClient(inputs: IGetOrganizationsClientInput): Promise<OrganizationsClient> {
    const { context, profile, region = "us-east-1" } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new OrganizationsClient({
            credentials,
            region
        });
    } else {
        return new OrganizationsClient({
            profile,
            region
        });
    }

}