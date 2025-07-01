// This file provides a factory function for creating AWS STS clients
// It handles credential loading from files to work around AWS SDK issues

import { STSClient } from "@aws-sdk/client-sts";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
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
 * This function creates an STSClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
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
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link STSClient} - AWS SDK STS client documentation
 */
export async function getSTSClient(inputs: IGetSTSClientInput): Promise<STSClient> {
  const { context, profile, region = "us-east-1" } = inputs;

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = profile ? await getCredsFromFile({ context, profile }) : undefined;

  if (credentials) {
    return new STSClient({
      credentials,
      region
    });
  } else {
    return new STSClient({
      profile: profile || undefined,
      region
    });
  }
}