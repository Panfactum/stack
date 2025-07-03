// This file provides a factory function for creating AWS Organizations clients
// It uses the generic AWS client factory for consistent credential handling

import { OrganizationsClient } from "@aws-sdk/client-organizations";
import { createAWSClient } from "@/util/aws/clients/createAWSClient";
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
 * This function creates an OrganizationsClient using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
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
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link OrganizationsClient} - AWS SDK Organizations client documentation
 */
export async function getOrganizationsClient(inputs: IGetOrganizationsClientInput): Promise<OrganizationsClient> {
    return createAWSClient({
        clientClass: OrganizationsClient,
        defaultRegion: "us-east-1"
    }, inputs);
}