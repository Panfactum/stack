// This file provides a factory function for creating AWS EC2 clients
// It uses the generic createAWSClient factory to reduce code duplication

import { EC2Client } from '@aws-sdk/client-ec2'
import { createAWSClient } from './createAWSClient'
import type { PanfactumContext } from '@/util/context/context'

/**
 * Input parameters for creating an EC2 client
 */
interface IGetEC2ClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext
  /** AWS profile name to use for credentials */
  profile?: string
  /** AWS region for the client (default: us-east-1) */
  region?: string
}

/**
 * Creates an AWS EC2 client with proper credential handling
 * 
 * @remarks
 * This function creates an EC2Client using the centralized createAWSClient factory,
 * which handles the AWS SDK bug workaround and credential loading consistently
 * across all AWS service clients.
 * 
 * @param params - Configuration for the EC2 client
 * @returns Configured AWS EC2 client
 * 
 * @example
 * ```typescript
 * const ec2Client = await getEC2Client({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * 
 * const instances = await ec2Client.send(new DescribeInstancesCommand({}));
 * ```
 * 
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link EC2Client} - AWS SDK EC2 client documentation
 */
export const getEC2Client = async (params: IGetEC2ClientInput): Promise<EC2Client> => {
  return createAWSClient(
    {
      clientClass: EC2Client,
      defaultRegion: 'us-east-1'
    },
    params
  )
}