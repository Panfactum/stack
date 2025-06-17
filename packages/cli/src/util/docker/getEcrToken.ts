import { GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';
import { GetAuthorizationTokenCommand as GetPublicAuthCommand } from '@aws-sdk/client-ecr-public';
import { CLIError } from '@/util/error/error';
import { getECRClient } from '../aws/clients/getECRClient';
import { getECRPublicClient } from '../aws/clients/getECRPublicClient';
import type { PanfactumContext } from '@/util/context/context'


export async function getEcrToken(
  context: PanfactumContext,
  registry: string,
  awsProfile?: string
): Promise<{ username: string; password: string }> {
  const isPublicRegistry = registry.includes('public.ecr.aws');
  
  try {
    let token: string;
    
    if (isPublicRegistry) {
      // Use ECR Public client (public registry is always in us-east-1)
      const client = await getECRPublicClient({ context, profile: awsProfile, region: 'us-east-1' });
      
      context.logger.debug('Getting ECR public authorization token', { registry });
      const response = await client.send(new GetPublicAuthCommand({}));
      
      if (!response.authorizationData?.authorizationToken) {
        throw new CLIError('No authorization token returned from ECR Public');
      }
      
      token = response.authorizationData.authorizationToken;
    } else {
      // Extract region from registry URL (format: <accountId>.dkr.ecr.<region>.amazonaws.com)
      const regionMatch = registry.match(/\.ecr\.([^.]+)\.amazonaws\.com/);
      const region = regionMatch ? regionMatch[1] : 'us-east-1';
      
      const client = await getECRClient({ context, profile: awsProfile, region });
      
      context.logger.debug('Getting ECR private authorization token', { registry, region });
      const response = await client.send(new GetAuthorizationTokenCommand({}));
      
      if (!response.authorizationData?.[0]?.authorizationToken) {
        throw new CLIError('No authorization token returned from ECR');
      }
      
      token = response.authorizationData[0].authorizationToken;
    }

    // ECR tokens are base64 encoded username:password
    const decoded = globalThis.Buffer.from(token, 'base64').toString('utf8');
    const [username, password] = decoded.split(':');

    if (!username || !password) {
      throw new CLIError('Invalid token format received from ECR');
    }

    return { username, password };
    
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    throw new CLIError(`Failed to get ECR token for registry '${registry}'`, error);
  }
}