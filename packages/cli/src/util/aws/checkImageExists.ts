// This file provides utilities for checking if Docker images exist in ECR
// It uses the AWS ECR API to query repository contents

import { ListImagesCommand } from '@aws-sdk/client-ecr';
import { getECRClient } from './clients/getECRClient';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Input parameters for checking ECR image existence
 */
interface ICheckImageExistsInput {
  /** AWS account ID containing the ECR repository */
  accountId: string;
  /** ECR repository name */
  repoName: string;
  /** Docker image tag to check */
  tag: string;
  /** AWS region where the ECR repository is located */
  region: string;
  /** AWS profile to use for authentication */
  profile: string;
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
}

/**
 * Checks if a Docker image with a specific tag exists in an ECR repository
 * 
 * @remarks
 * This function queries AWS ECR to determine if an image with the specified
 * tag exists in the given repository. It's useful for validating image
 * availability before attempting pulls or deployments.
 * 
 * @param input - Configuration for checking image existence
 * @returns True if the image exists, false otherwise
 * 
 * @example
 * ```typescript
 * const exists = await checkImageExists({
 *   accountId: '123456789012',
 *   repoName: 'my-app',
 *   tag: 'v1.2.3',
 *   region: 'us-east-1',
 *   profile: 'production',
 *   context
 * });
 * if (!exists) {
 *   console.log('Image not found, building...');
 * }
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to connect to ECR or access the repository
 * 
 * @see {@link getECRClient} - For ECR client creation
 */
export async function checkImageExists(input: ICheckImageExistsInput): Promise<boolean> {
  const { accountId, repoName, tag, region, profile, context } = input;
  
  const client = await getECRClient({ context, region, profile });

  const result = await client.send(new ListImagesCommand({
    registryId: accountId,
    repositoryName: repoName
  }));

  // Check if any image has the specified tag
  return result.imageIds?.some(image => image.imageTag === tag) ?? false;
}