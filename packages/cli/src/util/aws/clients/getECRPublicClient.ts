// This file provides a factory function for creating AWS ECR Public clients
// It uses the generic createAWSClient factory to reduce code duplication

import { ECRPUBLICClient } from "@aws-sdk/client-ecr-public";
import { createAWSClient } from "./createAWSClient";
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
 * This function creates an ECRPUBLICClient using the centralized createAWSClient factory,
 * which handles the AWS SDK bug workaround and credential loading consistently
 * across all AWS service clients. ECR Public API is only available in the us-east-1 region,
 * so the region is hardcoded.
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
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link ECRPUBLICClient} - AWS SDK ECR Public client documentation
 */
export async function getECRPublicClient(inputs: IGetECRPublicClientInput): Promise<ECRPUBLICClient> {
  return createAWSClient(
    {
      clientClass: ECRPUBLICClient,
      defaultRegion: "us-east-1"
    },
    {
      context: inputs.context,
      profile: inputs.profile,
      region: "us-east-1" // ECR Public is only available in us-east-1
    }
  );
}