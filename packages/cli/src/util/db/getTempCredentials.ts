import { execute } from '../subprocess/execute'
import { getVaultTokenString } from '../vault/getToken'
import type { DatabaseCredentials } from './types'
import type { PanfactumContext } from '@/util/context/context'

export async function getTempCredentials(
  context: PanfactumContext,
  vaultRole: string
): Promise<DatabaseCredentials> {
  // Get vault token
  const vaultToken = await getVaultTokenString({ address: '' }) // Will use default from env

  // Get database credentials from vault
  const { stdout } = await execute({
    command: ['vault', 'read', '-format=json', vaultRole],
    context,
    workingDirectory: process.cwd(),
    env: {
      VAULT_TOKEN: vaultToken,
    },
  })

  const result = JSON.parse(stdout)
  
  return {
    username: result.data.username,
    password: result.data.password,
    leaseId: result.lease_id,
  }
}