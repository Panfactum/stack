import { ListImagesCommand } from '@aws-sdk/client-ecr';
import { getECRClient } from './clients/getECRClient';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Check if an image with the specified tag exists in an ECR repository
 * 
 * @param accountId - AWS account ID that owns the ECR registry
 * @param repoName - ECR repository name
 * @param tag - Image tag to search for
 * @param region - AWS region where the ECR repository is located
 * @param context - Panfactum context for logging and AWS credentials
 * @returns Promise<boolean> - true if image exists, false otherwise
 */
export async function checkImageExists(
  accountId: string,
  repoName: string,
  tag: string,
  region: string,
  context: PanfactumContext
): Promise<boolean> {
  try {
    const client = await getECRClient({ context, region });

    const result = await client.send(new ListImagesCommand({
      registryId: accountId,
      repositoryName: repoName
    }));

    // Check if any image has the specified tag
    return result.imageIds?.some(image => image.imageTag === tag) ?? false;
  } catch (error) {
    // Log the error but don't throw - let the caller handle retry logic
    context.logger.warn(`Error checking for image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}