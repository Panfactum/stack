// This file provides a factory function for creating AWS Auto Scaling clients
// It uses the generic createAWSClient factory to reduce code duplication

import { AutoScalingClient } from "@aws-sdk/client-auto-scaling";
import { createAWSClient } from "./createAWSClient";
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
 * This function creates an AutoScalingClient using the centralized createAWSClient factory,
 * which handles the AWS SDK bug workaround and credential loading consistently
 * across all AWS service clients.
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
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link AutoScalingClient} - AWS SDK Auto Scaling client documentation
 */
export async function getAutoScalingClient(inputs: IGetAutoScalingClientInput): Promise<AutoScalingClient> {
  return createAWSClient(
    {
      clientClass: AutoScalingClient,
      defaultRegion: undefined // Region is required for Auto Scaling
    },
    inputs
  );
}