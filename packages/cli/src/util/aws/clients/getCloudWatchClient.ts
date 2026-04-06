// This file provides a factory function for creating AWS CloudWatch clients
// It uses the generic createAWSClient factory to reduce code duplication

import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { createAWSClient } from "./createAWSClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating a CloudWatch client
 */
interface IGetCloudWatchClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile?: string;
  /** AWS region for the client (default: us-east-1) */
  region?: string;
}

/**
 * Creates an AWS CloudWatch client with proper credential handling
 *
 * @remarks
 * This function creates a CloudWatchClient using the centralized createAWSClient factory,
 * which handles the AWS SDK bug workaround and credential loading consistently
 * across all AWS service clients.
 *
 * @param params - Configuration for the CloudWatch client
 * @returns Configured AWS CloudWatch client
 *
 * @example
 * ```typescript
 * const cloudWatchClient = await getCloudWatchClient({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 *
 * const metrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
 *   Namespace: 'AWS/Usage',
 *   MetricName: 'ResourceCount',
 *   ...
 * }));
 * ```
 *
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link CloudWatchClient} - AWS SDK CloudWatch client documentation
 */
export async function getCloudWatchClient(
  params: IGetCloudWatchClientInput
): Promise<CloudWatchClient> {
  return createAWSClient(
    {
      clientClass: CloudWatchClient,
      defaultRegion: "us-east-1",
    },
    params
  );
}
