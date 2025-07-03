// This file provides a factory function for creating AWS ELBv2 clients
// It uses the generic AWS client factory for consistent credential handling

import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2'
import { createAWSClient } from '@/util/aws/clients/createAWSClient'
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
 * This function creates an ElasticLoadBalancingV2Client using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
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
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link ElasticLoadBalancingV2Client} - AWS SDK ELBv2 client documentation
 */
export const getELBv2Client = async (params: IGetELBv2ClientInput): Promise<ElasticLoadBalancingV2Client> => {
  return createAWSClient({
    clientClass: ElasticLoadBalancingV2Client,
    defaultRegion: 'us-east-1'
  }, params)
}