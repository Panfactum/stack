// This file provides a factory function for creating AWS EKS clients
// It handles credential loading from files to work around AWS SDK issues

import { EKSClient } from "@aws-sdk/client-eks";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an EKS client
 */
interface IGetEKSClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile?: string;
  /** AWS region for the client (default: us-east-1) */
  region?: string;
}

/**
 * Creates an AWS EKS (Elastic Kubernetes Service) client with proper credential handling
 * 
 * @remarks
 * This function creates an EKSClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
 * 
 * @param inputs - Configuration for the EKS client
 * @returns Configured AWS EKS client
 * 
 * @example
 * ```typescript
 * const eksClient = await getEKSClient({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * 
 * const clusters = await eksClient.send(
 *   new ListClustersCommand({})
 * );
 * ```
 * 
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link EKSClient} - AWS SDK EKS client documentation
 */
export async function getEKSClient(inputs: IGetEKSClientInput): Promise<EKSClient> {
  const { context, profile, region = "us-east-1" } = inputs;

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = profile ? await getCredsFromFile({ context, profile }) : undefined;

  if (credentials) {
    return new EKSClient({
      credentials,
      region
    });
  } else {
    return new EKSClient({
      profile,
      region
    });
  }
}