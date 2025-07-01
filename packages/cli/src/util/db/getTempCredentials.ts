import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { getVaultToken } from '@/util/vault/getVaultToken'
import { parseJson } from '@/util/zod/parseJson'
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
  const vaultToken = await getVaultToken({ context, address: vaultAddress }) // Will use default from env
  
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
    
    // Define schema for vault PKI response
    const VaultPKIResponseSchema = z.object({
      data: z.object({
        issuing_ca: z.string(),
        certificate: z.string(),
        private_key: z.string()
      }),
      lease_id: z.string()
    });
    
    // Parse and validate JSON response
    const result = parseJson(VaultPKIResponseSchema, stdout)
    
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
    
    // Define schema for vault database credentials response
    const VaultCredsResponseSchema = z.object({
      data: z.object({
        username: z.string(),
        password: z.string()
      }),
      lease_id: z.string()
    });
    
    // Parse and validate JSON response
    const result = parseJson(VaultCredsResponseSchema, stdout)
    
    return {
      username: result.data.username,
      password: result.data.password,
      leaseId: result.lease_id,
    }
  }
}