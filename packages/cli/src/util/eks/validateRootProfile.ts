import { CLIError } from '@/util/error/error'
import { getIdentity } from '../aws/getIdentity'
import type { PanfactumContext } from '@/util/context/context'

export async function validateRootProfile(profile: string, context: PanfactumContext): Promise<void> {
  // Check if the provided profile is for a root user
  try {
    const identity = await getIdentity({ context, profile })
    
    if (!identity.Arn || !identity.Arn.includes('root')) {
      throw new CLIError(`Provided profile is not the root user. Ensure that the aws profile set in your './kube/config.user.yaml' is for a root user.`)
    }
  } catch (error) {
    if (error instanceof CLIError) {
      throw error
    }
    throw new CLIError('Unknown error occurred', { cause: error })
  }
}