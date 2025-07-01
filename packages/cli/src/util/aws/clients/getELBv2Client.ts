// This file provides a factory function for creating AWS ELBv2 clients
// It handles credential loading from files to work around AWS SDK issues

import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2'
import { getCredsFromFile } from '@/util/aws/getCredsFromFile'
import type { PanfactumContext } from '@/util/context/context'

/**
 * Input parameters for creating an ELBv2 client
 */
interface IGetELBv2ClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext
  /** AWS profile name to use for credentials */
  profile?: string
  /** AWS region for the client (default: us-east-1) */
  region?: string
}

/**
 * Creates an AWS Elastic Load Balancing v2 client with proper credential handling
 * 
 * @remarks
 * This function creates an ElasticLoadBalancingV2Client with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
 * 
 * @param params - Configuration for the ELBv2 client
 * @returns Configured AWS ELBv2 client
 * 
 * @example
 * ```typescript
 * const elbClient = await getELBv2Client({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * 
 * const loadBalancers = await elbClient.send(
 *   new DescribeLoadBalancersCommand({})
 * );
 * ```
 * 
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link ElasticLoadBalancingV2Client} - AWS SDK ELBv2 client documentation
 */
export const getELBv2Client = async (params: IGetELBv2ClientInput): Promise<ElasticLoadBalancingV2Client> => {
  const { context, profile, region = 'us-east-1' } = params

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = profile ? await getCredsFromFile({ context, profile }) : undefined

  if (credentials) {
    return new ElasticLoadBalancingV2Client({
      credentials,
      region
    })
  } else {
    return new ElasticLoadBalancingV2Client({
      profile,
      region
    })
  }
}