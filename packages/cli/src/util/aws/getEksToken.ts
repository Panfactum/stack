// Utility to get EKS authentication tokens using AWS CLI with Zod validation
// Uses AWS CLI for token generation with proper error handling and type safety

import { z } from 'zod';
import { CLIError } from '../error/error';
import { execute } from '../subprocess/execute';
import type { PanfactumContext } from '@/util/context/context';

const EKS_TOKEN_SCHEMA = z.object({
  kind: z.string(),
  apiVersion: z.string(),
  spec: z.object({}),
  status: z.object({
    expirationTimestamp: z.string(),
    token: z.string()
  })
});

export type EKSTokenResponse = z.infer<typeof EKS_TOKEN_SCHEMA>;

export async function getEksToken(
  context: PanfactumContext,
  clusterName: string,
  region: string,
  awsProfile: string
): Promise<EKSTokenResponse> {
  try {
    context.logger.debug('Getting EKS authentication token', { clusterName, region, profile: awsProfile });
    
    // Use AWS CLI instead of SDK because EKS tokens require complex presigned URL generation
    // The token is a base64-encoded presigned STS GetCallerIdentity URL with EKS-specific headers
    // AWS CLI handles the intricate signature v4 calculations and proper header formatting
    const { stdout } = await execute({
      command: [
        'aws',
        '--region', region,
        '--profile', awsProfile,
        'eks', 'get-token',
        '--cluster-name', clusterName,
        '--output', 'json'
      ],
      context,
      workingDirectory: process.cwd(),
    });
    
    // Validate the response structure
    const token = EKS_TOKEN_SCHEMA.parse(JSON.parse(stdout));
    return token;
    
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    throw new CLIError(
      `Failed to get EKS token for cluster '${clusterName}' in region '${region}' with profile '${awsProfile}'`,
      error instanceof Error ? error : undefined
    );
  }
}