// This file provides a factory function for creating AWS EKS clients
// It uses the generic AWS client factory for consistent credential handling

import { EKSClient } from "@aws-sdk/client-eks";
import { createAWSClient } from "@/util/aws/clients/createAWSClient";
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
 * This function creates an EKSClient using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
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
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link EKSClient} - AWS SDK EKS client documentation
 */
export async function getEKSClient(inputs: IGetEKSClientInput): Promise<EKSClient> {
  return createAWSClient({
    clientClass: EKSClient,
    defaultRegion: "us-east-1"
  }, inputs);
}