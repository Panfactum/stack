// This file provides a factory function for creating AWS STS clients
// It uses the generic AWS client factory for consistent credential handling

import { STSClient } from "@aws-sdk/client-sts";
import { createAWSClient } from "@/util/aws/clients/createAWSClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an STS client
 */
interface IGetSTSClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile?: string;
  /** AWS region for the client (default: us-east-1) */
  region?: string;
}

/**
 * Creates an AWS STS client with proper credential handling
 * 
 * @remarks
 * This function creates an STSClient using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
 * 
 * @param inputs - Configuration for the STS client
 * @returns Configured AWS STS client
 * 
 * @example
 * ```typescript
 * const stsClient = await getSTSClient({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * 
 * const identity = await stsClient.send(new GetCallerIdentityCommand({}));
 * ```
 * 
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link STSClient} - AWS SDK STS client documentation
 */
export async function getSTSClient(inputs: IGetSTSClientInput): Promise<STSClient> {
  return createAWSClient({
    clientClass: STSClient,
    defaultRegion: "us-east-1"
  }, inputs);
}