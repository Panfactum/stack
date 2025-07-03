// This file provides a factory function for creating AWS Service Quotas clients
// It uses the generic AWS client factory for consistent credential handling

import { ServiceQuotasClient } from "@aws-sdk/client-service-quotas";
import { createAWSClient } from "@/util/aws/clients/createAWSClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating a Service Quotas client
 */
interface IGetServiceQuotasClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client */
  region: string;
}

/**
 * Creates an AWS Service Quotas client with proper credential handling
 * 
 * @remarks
 * This function creates a ServiceQuotasClient using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
 * 
 * @param inputs - Configuration for the Service Quotas client
 * @returns Configured AWS Service Quotas client
 * 
 * @example
 * ```typescript
 * const quotasClient = await getServiceQuotasClient({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * 
 * const quotas = await quotasClient.send(new ListServiceQuotasCommand({
 *   ServiceCode: 'ec2'
 * }));
 * ```
 * 
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link ServiceQuotasClient} - AWS SDK Service Quotas client documentation
 */
export async function getServiceQuotasClient(inputs: IGetServiceQuotasClientInput): Promise<ServiceQuotasClient> {
    return createAWSClient({
        clientClass: ServiceQuotasClient
        // No defaultRegion - Service Quotas requires explicit region specification
    }, inputs);
}