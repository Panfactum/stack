// This file provides utilities for retrieving temporary database credentials from Vault
// It supports both traditional username/password and certificate-based authentication

import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { getVaultToken } from '@/util/vault/getVaultToken'
import { parseJson } from '@/util/zod/parseJson'
import { execute } from '../subprocess/execute'
import type { IDatabaseCredentials, DatabaseType } from './types'
import type { PanfactumContext } from '@/util/context/context'

/**
 * Input parameters for retrieving temporary database credentials
 */
interface IGetTempCredentialsInput {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext;
  /** Vault server address */
  vaultAddress: string;
  /** Vault role name for credential generation */
  vaultRole: string;
  /** Type of database (for NATS certificate handling) */
  databaseType?: DatabaseType;
  /** Database name (required for NATS) */
  databaseName?: string;
  /** Kubernetes namespace (required for NATS) */
  databaseNamespace?: string;
}

/**
 * Retrieves temporary database credentials from HashiCorp Vault
 * 
 * @remarks
 * This function handles two types of credential generation:
 * 
 * 1. **Traditional Credentials** (PostgreSQL, Redis):
 *    - Requests username/password from Vault database secrets engine
 *    - Returns temporary credentials with automatic rotation
 *    - Includes lease ID for credential lifecycle management
 * 
 * 2. **Certificate-Based Auth** (NATS):
 *    - Generates PKI certificates from Vault PKI engine
 *    - Writes certificates to filesystem for client use
 *    - Returns certificate file paths instead of passwords
 * 
 * Security considerations:
 * - Credentials are temporary and auto-expire
 * - Vault tokens are handled securely
 * - Certificate files are written with appropriate permissions
 * - Lease IDs enable credential revocation
 * 
 * Common use cases:
 * - Database migrations requiring admin access
 * - Temporary debugging sessions
 * - Automated testing with isolated credentials
 * - Service-to-service authentication
 * 
 * @param input - Configuration for credential retrieval
 * @returns Database credentials or certificate paths
 * 
 * @example
 * ```typescript
 * // Get PostgreSQL credentials
 * const creds = await getTempCredentials({
 *   context,
 *   vaultAddress: 'https://vault.example.com',
 *   vaultRole: 'db/creds/myapp-admin',
 *   databaseType: 'postgresql'
 * });
 * console.log(`Username: ${creds.username}`);
 * ```
 * 
 * @example
 * ```typescript
 * // Get NATS certificates
 * const creds = await getTempCredentials({
 *   context,
 *   vaultAddress: 'https://vault.example.com',
 *   vaultRole: 'nats-client',
 *   databaseType: 'nats',
 *   databaseName: 'events',
 *   databaseNamespace: 'production'
 * });
 * console.log(`Certificate: ${creds.certs?.cert}`);
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when Vault commands fail
 * 
 * @throws {@link PanfactumZodError}
 * Throws when Vault response doesn't match expected schema
 * 
 * @see {@link getVaultToken} - For Vault authentication
 * @see {@link IDatabaseCredentials} - Credential structure
 */
export async function getTempCredentials(
  input: IGetTempCredentialsInput
): Promise<IDatabaseCredentials> {
  const { context, vaultAddress, vaultRole, databaseType, databaseName, databaseNamespace } = input;
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
    const vaultPKIResponseSchema = z.object({
      data: z.object({
        /** CA certificate that issued the client certificate */
        issuing_ca: z.string().describe('Issuing CA certificate'),
        /** Client certificate for authentication */
        certificate: z.string().describe('Client certificate'),
        /** Private key for the client certificate */
        private_key: z.string().describe('Certificate private key')
      }).describe('PKI certificate data'),
      /** Vault lease ID for certificate lifecycle */
      lease_id: z.string().describe('Vault lease identifier')
    }).describe('Vault PKI certificate response');
    
    // Parse and validate JSON response
    const result = parseJson(vaultPKIResponseSchema, stdout)
    
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
    const vaultCredsResponseSchema = z.object({
      data: z.object({
        /** Temporary database username */
        username: z.string().describe('Database username'),
        /** Temporary database password */
        password: z.string().describe('Database password')
      }).describe('Database credential data'),
      /** Vault lease ID for credential lifecycle */
      lease_id: z.string().describe('Vault lease identifier')
    }).describe('Vault database credentials response');
    
    // Parse and validate JSON response
    const result = parseJson(vaultCredsResponseSchema, stdout)
    
    return {
      username: result.data.username,
      password: result.data.password,
      leaseId: result.lease_id,
    }
  }
}