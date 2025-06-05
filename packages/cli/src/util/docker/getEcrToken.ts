import { ECRClient, GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';
import { ECRPUBLICClient, GetAuthorizationTokenCommand as GetPublicAuthCommand } from '@aws-sdk/client-ecr-public';
import { getCredsFromFile } from '../aws/getCredsFromFile';
import { CLIError } from '../error/error';
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
      // Use ECR Public client
      const credentials = awsProfile ? await getCredsFromFile({ context, profile: awsProfile }) : undefined;
      const client = credentials 
        ? new ECRPUBLICClient({ credentials, region: 'us-east-1' })
        : new ECRPUBLICClient({ profile: awsProfile || undefined, region: 'us-east-1' });
      
      context.logger.debug('Getting ECR public authorization token', { registry });
      const response = await client.send(new GetPublicAuthCommand({}));
      
      if (!response.authorizationData?.authorizationToken) {
        throw new CLIError('No authorization token returned from ECR Public');
      }
      
      token = response.authorizationData.authorizationToken;
    } else {
      const credentials = awsProfile ? await getCredsFromFile({ context, profile: awsProfile }) : undefined;
      const client = credentials
        ? new ECRClient({ credentials, region: 'us-east-1' })
        : new ECRClient({ profile: awsProfile || undefined, region: 'us-east-1' });
      
      context.logger.debug('Getting ECR private authorization token', { registry});
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