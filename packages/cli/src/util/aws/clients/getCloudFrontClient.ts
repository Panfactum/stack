// This file provides a factory function for creating AWS CloudFront clients
// It uses the generic AWS client factory for consistent credential handling

import { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import { createAWSClient } from "@/util/aws/clients/createAWSClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating a CloudFront client
 */
interface IGetCloudFrontClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client (optional and ignored — CloudFront is a global service) */
  region?: string;
}

/**
 * Creates an AWS CloudFront client with proper credential handling
 *
 * @remarks
 * This function creates a CloudFrontClient using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
 *
 * CloudFront is a global service and all of its API endpoints live in
 * `us-east-1`. The factory always pins the client to `us-east-1` regardless
 * of the region passed in. The `region` field is kept on the input interface
 * purely for symmetry with the other AWS client wrappers in this directory.
 *
 * @param inputs - Configuration for the CloudFront client
 * @returns Configured AWS CloudFront client
 *
 * @example
 * ```typescript
 * const cloudFrontClient = await getCloudFrontClient({
 *   context,
 *   profile: 'production'
 * });
 *
 * const distributions = await cloudFrontClient.send(new ListDistributionsCommand({
 *   MaxItems: '1'
 * }));
 * ```
 *
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link CloudFrontClient} - AWS SDK CloudFront client documentation
 */
export async function getCloudFrontClient(inputs: IGetCloudFrontClientInput): Promise<CloudFrontClient> {
    return createAWSClient({
        clientClass: CloudFrontClient,
        defaultRegion: "us-east-1"
    }, inputs);
}
