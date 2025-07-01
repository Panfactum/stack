// This file provides a factory function for creating AWS Systems Manager (SSM) clients
// It handles credential loading from files to work around AWS SDK issues

import { SSMClient } from "@aws-sdk/client-ssm";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
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
 * This function creates an SSMClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
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
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link SSMClient} - AWS SDK SSM client documentation
 */
export async function getSSMClient(inputs: IGetSSMClientInput): Promise<SSMClient> {
  const { context, profile, region } = inputs;

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = await getCredsFromFile({ context, profile });

  if (credentials) {
    return new SSMClient({
      credentials,
      region
    });
  } else {
    return new SSMClient({
      profile,
      region
    });
  }
}