import { GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';
import { GetAuthorizationTokenCommand as GetPublicAuthCommand } from '@aws-sdk/client-ecr-public';
import { z } from 'zod';
import { CLIError, PanfactumZodError } from '@/util/error/error';
import { getCachedCredential, setCachedCredential } from './credentialCache';
import { getECRClient } from '../aws/clients/getECRClient';
import { getECRPublicClient } from '../aws/clients/getECRPublicClient';
import type { PanfactumContext } from '@/util/context/context'


const ecrTokenSchema = z.string().transform((token, ctx) => {
  const decoded = globalThis.Buffer.from(token, 'base64').toString('utf8');
  const parts = decoded.split(':');
  
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid ECR token format: expected base64 encoded username:password'
    });
    return z.NEVER;
  }
  
  return { username: parts[0], password: parts[1] };
})

export interface GetECRTokenOptions {
  context: PanfactumContext
  registry: string
  awsProfile: string
  skipCache?: boolean
}

export function parseECRToken(token: string): { username: string; password: string } {
  const parseResult = ecrTokenSchema.safeParse(token);
  if (!parseResult.success) {
    throw new PanfactumZodError(
      'Invalid ECR authorization token format',
      'ECR GetAuthorizationToken response',
      parseResult.error
    );
  }
  return parseResult.data;
}

export async function getECRToken(options: GetECRTokenOptions): Promise<string> {
  const { context, registry, awsProfile, skipCache = false } = options
  
  // Check cache first unless skipped
  if (!skipCache) {
    const cachedToken = await getCachedCredential(context, registry)
    if (cachedToken) {
      context.logger.debug('Using cached ECR token', { registry })
      return cachedToken
    }
  }
  
  // Get fresh token
  const token = await fetchECRToken(context, registry, awsProfile)
  
  // Cache the token unless skipped
  if (!skipCache) {
    await setCachedCredential(context, registry, token)
  }
  
  return token
}

// Private function that contains the original token fetching logic
async function fetchECRToken(
  context: PanfactumContext,
  registry: string,
  awsProfile: string
): Promise<string> {
  const isPublicRegistry = registry.includes('public.ecr.aws');
  
  if (isPublicRegistry) {
    // Use ECR Public client (public registry is always in us-east-1)
    const client = await getECRPublicClient({ context, profile: awsProfile })
      .catch((error: unknown) => {
        throw new CLIError(
          `Failed to create ECR Public client for profile '${awsProfile}'`,
          error
        );
      });
    
    context.logger.debug('Getting ECR public authorization token', { registry });
    const response = await client.send(new GetPublicAuthCommand({}))
      .catch((error: unknown) => {
        throw new CLIError(
          `Failed to get authorization token from ECR Public`,
          error
        );
      });
    
    if (!response.authorizationData?.authorizationToken) {
      throw new CLIError('No authorization token returned from ECR Public');
    }
    
    return response.authorizationData.authorizationToken;
  } else {
    // Extract region from registry URL (format: <accountId>.dkr.ecr.<region>.amazonaws.com)
    const regionMatch = registry.match(/\.ecr\.([^.]+)\.amazonaws\.com/);
    const region = regionMatch?.[1] ?? 'us-east-1';
    
    const client = await getECRClient({ context, profile: awsProfile, region })
      .catch((error: unknown) => {
        throw new CLIError(
          `Failed to create ECR client for profile '${awsProfile}' in region '${region}'`,
          error
        );
      });
    
    context.logger.debug('Getting ECR private authorization token', { registry, region });
    const response = await client.send(new GetAuthorizationTokenCommand({}))
      .catch((error: unknown) => {
        throw new CLIError(
          `Failed to get authorization token from ECR in region '${region}'`,
          error
        );
      });
    
    if (!response.authorizationData?.[0]?.authorizationToken) {
      throw new CLIError('No authorization token returned from ECR');
    }
    
    return response.authorizationData[0].authorizationToken;
  }
}