import { z } from 'zod';
import { parseJson } from '@/util/zod/parseJson';
import { execute } from '../subprocess/execute'
import type { PanfactumContext } from '@/util/context/context'

// Zod schemas for ECR authorization responses
const ECR_PUBLIC_AUTH_SCHEMA = z.object({
  authorizationData: z.object({
    authorizationToken: z.string()
  }).passthrough()
}).passthrough();

const ECR_PRIVATE_AUTH_SCHEMA = z.object({
  authorizationData: z.array(z.object({
    authorizationToken: z.string()
  }).passthrough())
}).passthrough();


export async function getEcrToken(
  context: PanfactumContext,
  registry: string,
  awsProfile?: string
): Promise<{ username: string; password: string }> {
  const isPublicRegistry = registry.includes('public.ecr.aws')
  
  let command: string
  if (isPublicRegistry) {
    command = 'aws ecr-public get-authorization-token --output json'
  } else {
    // Extract registry ID from private ECR URL
    const registryId = registry.split('.')[0]
    command = `aws ecr get-authorization-token --registry-ids ${registryId} --output json`
  }

  if (awsProfile) {
    command += ` --profile ${awsProfile}`
  }

  const { stdout } = await execute({
    command: command.split(' '),
    context,
    workingDirectory: context.repoVariables.repo_root,
  })

  let token: string
  
  if (isPublicRegistry) {
    const response = parseJson(ECR_PUBLIC_AUTH_SCHEMA, stdout);
    token = response.authorizationData.authorizationToken
  } else {
    const response = parseJson(ECR_PRIVATE_AUTH_SCHEMA, stdout);
    token = response.authorizationData[0]?.authorizationToken || ''
  }

  // ECR tokens are base64 encoded username:password
  const decoded = globalThis.Buffer.from(token, 'base64').toString('utf8')
  const [username, password] = decoded.split(':')

  return { username: username || '', password: password || '' }
}