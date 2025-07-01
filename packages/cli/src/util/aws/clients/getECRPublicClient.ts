// This file provides a factory function for creating AWS ECR Public clients
// It handles credential loading from files to work around AWS SDK issues

import { ECRPUBLICClient } from "@aws-sdk/client-ecr-public";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an ECR Public client
 */
interface IGetECRPublicClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
}

/**
 * Creates an AWS ECR Public client with proper credential handling
 * 
 * @remarks
 * This function creates an ECRPUBLICClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified. ECR Public API is only available
 * in the us-east-1 region, so the region is hardcoded.
 * 
 * @param inputs - Configuration for the ECR Public client
 * @returns Configured AWS ECR Public client
 * 
 * @example
 * ```typescript
 * const ecrPublicClient = await getECRPublicClient({
 *   context,
 *   profile: 'production'
 * });
 * 
 * const registries = await ecrPublicClient.send(
 *   new DescribeRegistriesCommand({})
 * );
 * ```
 * 
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link ECRPUBLICClient} - AWS SDK ECR Public client documentation
 */
export async function getECRPublicClient(inputs: IGetECRPublicClientInput): Promise<ECRPUBLICClient> {
  const { context, profile } = inputs;
  const region = 'us-east-1'; // ECR Public is only available in us-east-1

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = await getCredsFromFile({ context, profile });

  if (credentials) {
    return new ECRPUBLICClient({
      credentials,
      region
    });
  } else {
    return new ECRPUBLICClient({
      profile,
      region
    });
  }
}