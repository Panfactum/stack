// This file provides a factory function for creating AWS Auto Scaling clients
// It handles credential loading from files to work around AWS SDK issues

import { AutoScalingClient } from "@aws-sdk/client-auto-scaling";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an Auto Scaling client
 */
interface IGetAutoScalingClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client */
  region: string;
}

/**
 * Creates an AWS Auto Scaling client with proper credential handling
 * 
 * @remarks
 * This function creates an AutoScalingClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
 * 
 * @param inputs - Configuration for the Auto Scaling client
 * @returns Configured AWS Auto Scaling client
 * 
 * @example
 * ```typescript
 * const autoScalingClient = await getAutoScalingClient({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * 
 * const groups = await autoScalingClient.send(
 *   new DescribeAutoScalingGroupsCommand({})
 * );
 * ```
 * 
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link AutoScalingClient} - AWS SDK Auto Scaling client documentation
 */
export async function getAutoScalingClient(inputs: IGetAutoScalingClientInput): Promise<AutoScalingClient> {
  const { context, profile, region } = inputs;

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = await getCredsFromFile({ context, profile });

  if (credentials) {
    return new AutoScalingClient({
      credentials,
      region
    });
  } else {
    return new AutoScalingClient({
      profile,
      region
    });
  }
}