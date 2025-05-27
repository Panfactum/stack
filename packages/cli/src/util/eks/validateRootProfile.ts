import { execute } from '../subprocess/execute'
import type { PanfactumContext } from '@/util/context/context'

export async function validateRootProfile(context: PanfactumContext): Promise<void> {
  // Check if we have root account access
  try {
    const { stdout } = await execute({
      command: ['aws', 'sts', 'get-caller-identity', '--output', 'json'],
      context,
      workingDirectory: process.cwd(),
    })
    
    const identity = JSON.parse(stdout)
    const accountId = identity.Account
    
    // Get organization info to verify root account
    const { stdout: orgStdout } = await execute({
      command: ['aws', 'organizations', 'describe-organization', '--output', 'json'],
      context,
      workingDirectory: process.cwd(),
    })
    
    const org = JSON.parse(orgStdout)
    const masterAccountId = org.Organization.MasterAccountId
    
    if (accountId !== masterAccountId) {
      throw new Error(`Current AWS profile is not for the root account. Expected ${masterAccountId}, got ${accountId}`)
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('AccessDeniedException') || error.message.includes('is not in organization'))) {
      throw new Error('AWS profile does not have root organization access')
    }
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown error occurred')
  }
}