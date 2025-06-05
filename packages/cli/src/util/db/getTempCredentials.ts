import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getVaultTokenString } from '@/util/vault/getVaultToken'
import { execute } from '../subprocess/execute'
import type { DatabaseCredentials, DatabaseType } from './types'
import type { PanfactumContext } from '@/util/context/context'

export async function getTempCredentials(
  context: PanfactumContext,
  vaultAddress: string,
  vaultRole: string,
  databaseType?: DatabaseType,
  databaseName?: string,
  databaseNamespace?: string
): Promise<DatabaseCredentials> {
  // Get vault token
  const vaultToken = await getVaultTokenString({ context, address: vaultAddress }) // Will use default from env
  
  if (databaseType === 'nats' && databaseName && databaseNamespace) {
    // NATS uses PKI certificates
    // Remove 'db/creds/' prefix if present, as NATS uses pki/internal/issue path
    const roleNameOnly = vaultRole.replace(/^db\/creds\//, '')
    const commonName = roleNameOnly.replace(/^nats-/, '') // Remove 'nats-' prefix
    const { stdout } = await execute({
      command: ['vault', 'write', '-format=json', `pki/internal/issue/${roleNameOnly}`, `common_name=${commonName}`],
      context,
      workingDirectory: context.repoVariables.repo_root,
      env: {
        ...process.env,
        VAULT_TOKEN: vaultToken,
        VAULT_ADDR: vaultAddress,
      },
    })
    
    const result = JSON.parse(stdout)
    
    // Write certificates to files
    const natsDir = context.repoVariables.nats_dir
    mkdirSync(natsDir, { recursive: true })
    
    const caFile = join(natsDir, `${databaseName}.${databaseNamespace}.ca.crt`)
    const certFile = join(natsDir, `${databaseName}.${databaseNamespace}.tls.crt`)
    const keyFile = join(natsDir, `${databaseName}.${databaseNamespace}.tls.key`)
    
    writeFileSync(caFile, result.data.issuing_ca)
    writeFileSync(certFile, result.data.certificate)
    writeFileSync(keyFile, result.data.private_key)
    
    // Return placeholder credentials with certificate paths
    return {
      username: 'nats-cert',
      password: ``,
      certs: {
        ca: caFile,
        cert: certFile,
        key: keyFile,
      },
      leaseId: result.lease_id,
    }
  } else {
    // PostgreSQL and Redis use database credentials
    const { stdout } = await execute({
      command: ['vault', 'read', '-format=json', vaultRole],
      context,
      workingDirectory: context.repoVariables.repo_root,
      env: {
        ...process.env,
        VAULT_TOKEN: vaultToken,
        VAULT_ADDR: vaultAddress,
      },
    })
    
    const result = JSON.parse(stdout)
    
    return {
      username: result.data.username,
      password: result.data.password,
      leaseId: result.lease_id,
    }
  }
}