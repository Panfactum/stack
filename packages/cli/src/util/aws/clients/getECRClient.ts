// This file provides a factory function for creating AWS ECR clients
// It uses the generic createAWSClient factory to reduce code duplication

import { ECRClient } from "@aws-sdk/client-ecr";
import { createAWSClient } from "./createAWSClient";
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
 * This function creates an ECRClient using the centralized createAWSClient factory,
 * which handles the AWS SDK bug workaround and credential loading consistently
 * across all AWS service clients.
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
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link ECRClient} - AWS SDK ECR client documentation
 */
export async function getECRClient(inputs: IGetECRClientInput): Promise<ECRClient> {
  return createAWSClient(
    {
      clientClass: ECRClient,
      defaultRegion: undefined // Region is required for ECR
    },
    inputs
  );
}