import { ListImagesCommand } from '@aws-sdk/client-ecr';
import { getECRClient } from './clients/getECRClient';
import type { PanfactumContext } from '@/util/context/context';

export async function checkImageExists(
  accountId: string,
  repoName: string,
  tag: string,
  region: string,
  profile: string,
  context: PanfactumContext
): Promise<boolean> {
  const client = await getECRClient({ context, region, profile });

  const result = await client.send(new ListImagesCommand({
    registryId: accountId,
    repositoryName: repoName
  }));

  // Check if any image has the specified tag
  return result.imageIds?.some(image => image.imageTag === tag) ?? false;
}