// This file provides a factory function for creating AWS IAM clients
// It uses the generic AWS client factory for consistent credential handling

import { IAMClient } from "@aws-sdk/client-iam";
import { createAWSClient } from "@/util/aws/clients/createAWSClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an IAM client
 */
interface IGetIAMClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client (default: us-east-1) */
  region?: string;
}

/**
 * Creates an AWS IAM client with proper credential handling
 * 
 * @remarks
 * This function creates an IAMClient using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
 * 
 * Note: IAM is a global service, so the region is always set to us-east-1
 * 
 * @param inputs - Configuration for the IAM client
 * @returns Configured AWS IAM client
 * 
 * @example
 * ```typescript
 * const iamClient = await getIAMClient({
 *   context,
 *   profile: 'production'
 * });
 * 
 * const users = await iamClient.send(new ListUsersCommand({}));
 * ```
 * 
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link IAMClient} - AWS SDK IAM client documentation
 */
export async function getIAMClient(inputs: IGetIAMClientInput): Promise<IAMClient> {
    return createAWSClient({
        clientClass: IAMClient,
        defaultRegion: "us-east-1"
    }, inputs);
}