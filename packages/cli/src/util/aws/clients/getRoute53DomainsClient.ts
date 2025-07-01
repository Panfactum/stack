// This file provides a factory function for creating AWS Route 53 Domains clients
// It handles credential loading from files to work around AWS SDK issues

import { Route53DomainsClient } from "@aws-sdk/client-route-53-domains";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating a Route 53 Domains client
 */
interface IGetRoute53DomainsClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client (default: us-east-1) */
  region?: string;
}

/**
 * Creates an AWS Route 53 Domains client with proper credential handling
 * 
 * @remarks
 * This function creates a Route53DomainsClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
 * 
 * Note: Route 53 Domains is only available in us-east-1
 * 
 * @param inputs - Configuration for the Route 53 Domains client
 * @returns Configured AWS Route 53 Domains client
 * 
 * @example
 * ```typescript
 * const domainsClient = await getRoute53DomainsClient({
 *   context,
 *   profile: 'production'
 * });
 * 
 * const domains = await domainsClient.send(new ListDomainsCommand({}));
 * ```
 * 
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link Route53DomainsClient} - AWS SDK Route 53 Domains client documentation
 */
export async function getRoute53DomainsClient(inputs: IGetRoute53DomainsClientInput): Promise<Route53DomainsClient> {
    const { context, profile, region = "us-east-1" } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new Route53DomainsClient({
            credentials,
            region
        });
    } else {
        return new Route53DomainsClient({
            profile,
            region
        });
    }

}