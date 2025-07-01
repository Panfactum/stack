// This file provides a factory function for creating AWS EC2 clients
// It handles credential loading from files to work around AWS SDK issues

import { EC2Client } from '@aws-sdk/client-ec2'
import { getCredsFromFile } from '@/util/aws/getCredsFromFile'
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
 * This function creates an EC2Client with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
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
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link EC2Client} - AWS SDK EC2 client documentation
 */
export const getEC2Client = async (params: IGetEC2ClientInput): Promise<EC2Client> => {
  const { context, profile, region = 'us-east-1' } = params

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = profile ? await getCredsFromFile({ context, profile }) : undefined

  if (credentials) {
    return new EC2Client({
      credentials,
      region
    })
  } else {
    return new EC2Client({
      profile,
      region
    })
  }
}