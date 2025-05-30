import { execute } from '../subprocess/execute'
import type { PanfactumContext } from '@/util/context/context'

export async function validateRootProfile(profile: string, context: PanfactumContext): Promise<void> {
  const workingDirectory = context.repoVariables.repo_root
  // Check if the provided profile is for a root user
  try {
    const { stdout } = await execute({
      command: ['aws', 'sts', 'get-caller-identity', '--profile', profile, '--output', 'json'],
      context,
      workingDirectory,
    })
    
    const identity = JSON.parse(stdout)
    const arn = identity.Arn
    
    if (!arn.includes('root')) {
      throw new Error(`Provided profile is not the root user. Ensure that the aws profile set in your './kube/config.user.yaml' is for a root user.`)
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown error occurred')
  }
}