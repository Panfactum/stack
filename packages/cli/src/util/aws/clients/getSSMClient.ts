// This file provides a factory function for creating AWS Systems Manager (SSM) clients
// It uses the generic AWS client factory for consistent credential handling

import { SSMClient } from "@aws-sdk/client-ssm";
import { createAWSClient } from "@/util/aws/clients/createAWSClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an SSM client
 */
interface IGetSSMClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client */
  region: string;
}

/**
 * Creates an AWS Systems Manager (SSM) client with proper credential handling
 * 
 * @remarks
 * This function creates an SSMClient using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
 * 
 * @param inputs - Configuration for the SSM client
 * @returns Configured AWS SSM client
 * 
 * @example
 * ```typescript
 * const ssmClient = await getSSMClient({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * 
 * const parameter = await ssmClient.send(new GetParameterCommand({
 *   Name: '/myapp/config'
 * }));
 * ```
 * 
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link SSMClient} - AWS SDK SSM client documentation
 */
export async function getSSMClient(inputs: IGetSSMClientInput): Promise<SSMClient> {
  return createAWSClient({
    clientClass: SSMClient
    // No defaultRegion - SSM requires explicit region specification
  }, inputs);
}