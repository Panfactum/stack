// This file provides utilities for retrieving database credentials from HashiCorp Vault
// It integrates with Vault's dynamic secrets engine for database credential management

import { z } from 'zod';
import { CLIError } from '@/util/error/error';
import { execute } from '@/util/subprocess/execute';
import { parseJson } from '@/util/zod/parseJson';
import { getVaultToken } from './getVaultToken';
import type {PanfactumContext} from "@/util/context/context.ts";

/**
 * Schema for Vault database credentials response
 * 
 * @remarks
 * Validates the JSON structure returned by `vault read -format=json db/creds/{role}`.
 * The response includes dynamically generated credentials and lease information
 * for automatic credential rotation.
 */
const VAULT_DB_CREDS_RESPONSE_SCHEMA = z.object({
  data: z.object({
    /** Dynamically generated database username */
    username: z.string(),
    /** Dynamically generated database password */
    password: z.string()
  }).passthrough(), // Allow additional fields like connection_url
  /** Lease identifier for renewal operations */
  lease_id: z.string().optional(),
  /** TTL of the credentials in seconds */
  lease_duration: z.number().optional()
}).passthrough() // Allow additional top-level fields like renewable, warnings
  .describe("Vault database credentials response schema");

/**
 * Options for retrieving database credentials from Vault
 */
export interface IGetDbCredsOptions {
  /** Vault database role name (e.g., "readonly", "readwrite") */
  role: string;
  /** Vault server address (optional, uses VAULT_ADDR env if not provided) */
  vaultAddress?: string;
  /** Panfactum context for configuration */
  context: PanfactumContext;
}

/**
 * Database credentials retrieved from Vault
 */
export interface IDbCredentials {
  /** Generated database username */
  username: string;
  /** Generated database password */
  password: string;
  /** Vault lease ID for credential renewal */
  leaseId: string;
  /** Credential lifetime in seconds */
  leaseDuration: number;
  /** Additional data from Vault response */
  data?: Record<string, unknown>;
}

/**
 * Retrieves dynamic database credentials from Vault
 * 
 * @remarks
 * This function interfaces with Vault's database secrets engine to obtain
 * temporary, automatically-rotated database credentials. The process:
 * 
 * 1. **Authentication**: Obtains a valid Vault token
 * 2. **Credential Request**: Reads from `db/creds/{role}` path
 * 3. **Dynamic Generation**: Vault creates new DB user/password
 * 4. **Lease Management**: Returns lease info for renewal
 * 
 * Key features of dynamic credentials:
 * - Automatically expire after lease duration
 * - Unique per request (no credential sharing)
 * - Vault handles credential revocation
 * - Supports multiple database engines (PostgreSQL, MySQL, etc.)
 * 
 * The credentials are typically used for:
 * - Application database connections
 * - Migration scripts
 * - Administrative tasks
 * - Temporary access for debugging
 * 
 * @param options - Configuration including role and Vault address
 * @returns Database credentials with lease information
 * 
 * @example
 * ```typescript
 * // Get read-only database credentials
 * const creds = await getDBCreds({
 *   context,
 *   role: 'readonly',
 *   vaultAddress: 'https://vault.example.com'
 * });
 * 
 * // Use credentials
 * const client = new DatabaseClient({
 *   username: creds.username,
 *   password: creds.password
 * });
 * 
 * // Credentials will auto-expire after leaseDuration seconds
 * console.log(`Credentials valid for ${creds.leaseDuration} seconds`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when role parameter is not provided
 * 
 * @throws {@link CLIError}
 * Throws when Vault authentication fails
 * 
 * @throws {@link CLIError}
 * Throws when credential retrieval fails (e.g., role doesn't exist)
 * 
 * @see {@link getVaultToken} - For Vault authentication
 * @see {@link getDbCredsFormatted} - For human-readable output format
 */
export async function getDBCreds(options: IGetDbCredsOptions): Promise<IDbCredentials> {
  const { role, vaultAddress, context } = options;

  if (!role) {
    throw new CLIError('role is a required argument.');
  }

  // Set up environment
  const env = { ...process.env };
  if (vaultAddress) {
    env['VAULT_ADDR'] = vaultAddress;
  }

  // Get Vault token
  const token = await getVaultToken({ context, address: vaultAddress });
  env['VAULT_TOKEN'] = token;

  // Read credentials from Vault
  const { stdout } = await execute({
    command: ['vault', 'read', '-format=json', `db/creds/${role}`],
    context,
    workingDirectory: context.repoVariables.repo_root,
    env
  }).catch((error: unknown) => {
    throw new CLIError(`Failed to get database credentials for role '${role}'`, error);
  });

  return parseVaultResponse(stdout);
}

/**
 * Parses the JSON response from vault read command
 * 
 * @internal
 * @param output - Raw JSON output from vault command
 * @returns Parsed and validated credentials
 * 
 * @throws {@link CLIError}
 * Throws when response format is invalid or parsing fails
 */
function parseVaultResponse(output: string): IDbCredentials {
  try {
    const response = parseJson(VAULT_DB_CREDS_RESPONSE_SCHEMA, output);

    return {
      username: response.data.username,
      password: response.data.password,
      leaseId: response.lease_id || '',
      leaseDuration: response.lease_duration || 0,
      data: response.data
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new CLIError(`Invalid Vault response format: ${error.message}`);
    }
    throw new CLIError(`Failed to parse Vault response:`, error);
  }
}

/**
 * Retrieves database credentials and formats them as human-readable text
 * 
 * @remarks
 * This function provides output similar to the native vault CLI command,
 * formatting credentials in a table structure. This is useful for:
 * - Command-line display
 * - Script integration
 * - Debugging and troubleshooting
 * - Manual credential inspection
 * 
 * The output format matches `vault read db/creds/{role}` output:
 * ```
 * Key                Value
 * ---                -----
 * lease_id           vault/database/creds/readonly/abc123
 * lease_duration     3600
 * lease_renewable    true
 * password           A1b2C3d4E5f6
 * username           v-readonly-xyz789
 * ```
 * 
 * @param options - Configuration including role and Vault address
 * @returns Formatted multi-line string with credentials table
 * 
 * @example
 * ```typescript
 * const formatted = await getDbCredsFormatted({
 *   context,
 *   role: 'readonly'
 * });
 * console.log(formatted);
 * // Outputs formatted table with credentials
 * ```
 * 
 * @throws {@link CLIError}
 * Inherits all error conditions from getDBCreds
 * 
 * @see {@link getDBCreds} - For programmatic access to credentials
 */
export async function getDbCredsFormatted(options: IGetDbCredsOptions): Promise<string> {
  const creds = await getDBCreds(options);
  
  // Format output similar to vault read command
  const lines = [
    `Key                Value`,
    `---                -----`,
    `lease_id           ${creds.leaseId}`,
    `lease_duration     ${creds.leaseDuration}`,
    `lease_renewable    true`,
    `password           ${creds.password}`,
    `username           ${creds.username}`
  ];

  // Add any additional data fields
  if (creds.data) {
    for (const [key, value] of Object.entries(creds.data)) {
      if (key !== 'username' && key !== 'password') {
        lines.push(`${key.padEnd(19)}${String(value)}`);
      }
    }
  }

  return lines.join('\n');
}