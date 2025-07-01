// This file provides a factory function for creating AWS Service Quotas clients
// It handles credential loading from files to work around AWS SDK issues

import { ServiceQuotasClient } from "@aws-sdk/client-service-quotas";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
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
 * This function creates a ServiceQuotasClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
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
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link ServiceQuotasClient} - AWS SDK Service Quotas client documentation
 */
export async function getServiceQuotasClient(inputs: IGetServiceQuotasClientInput): Promise<ServiceQuotasClient> {
    const { context, profile, region } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new ServiceQuotasClient({
            credentials,
            region
        });
    } else {
        return new ServiceQuotasClient({
            profile,
            region
        });
    }

}