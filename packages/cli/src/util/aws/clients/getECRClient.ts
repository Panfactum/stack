// This file provides a factory function for creating AWS ECR clients
// It handles credential loading from files to work around AWS SDK issues

import { ECRClient } from "@aws-sdk/client-ecr";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an ECR client
 */
interface IGetECRClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client */
  region: string;
}

/**
 * Creates an AWS ECR (Elastic Container Registry) client with proper credential handling
 * 
 * @remarks
 * This function creates an ECRClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
 * 
 * @param inputs - Configuration for the ECR client
 * @returns Configured AWS ECR client
 * 
 * @example
 * ```typescript
 * const ecrClient = await getECRClient({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * 
 * const repositories = await ecrClient.send(
 *   new DescribeRepositoriesCommand({})
 * );
 * ```
 * 
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link ECRClient} - AWS SDK ECR client documentation
 */
export async function getECRClient(inputs: IGetECRClientInput): Promise<ECRClient> {
  const { context, profile, region } = inputs;

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = await getCredsFromFile({ context, profile });

  if (credentials) {
    return new ECRClient({
      credentials,
      region
    });
  } else {
    return new ECRClient({
      profile,
      region
    });
  }
}