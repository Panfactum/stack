import { execSync } from 'child_process';
import { z } from 'zod';
import { CLIError } from '@/util/error/error';
import { parseJson } from '@/util/zod/parseJson';
import { getVaultTokenString } from './getVaultToken';
import type {PanfactumContext} from "@/util/context/context.ts";

// Zod schema for Vault database credentials response
const VAULT_DB_CREDS_RESPONSE_SCHEMA = z.object({
  data: z.object({
    username: z.string(),
    password: z.string()
  }).passthrough(), // Allow additional fields
  lease_id: z.string().optional(),
  lease_duration: z.number().optional()
}).passthrough(); // Allow additional top-level fields

export interface GetDbCredsOptions {
  role: string;
  vaultAddress?: string;
  context: PanfactumContext;
}

export interface DbCredentials {
  username: string;
  password: string;
  leaseId: string;
  leaseDuration: number;
  data?: Record<string, unknown>;
}

/**
 * Get database credentials from Vault for a specific role
 * 
 * @param options Configuration options including role and optional vault address
 * @returns Database credentials
 */
export async function getDBCreds(options: GetDbCredsOptions): Promise<DbCredentials> {
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
  const token = await getVaultTokenString({ context, address: vaultAddress });
  env['VAULT_TOKEN'] = token;

  // Read credentials from Vault
  try {
    const output = execSync(`vault read -format=json db/creds/${role}`, {
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return parseVaultResponse(output);
  } catch (error) {
    throw new CLIError(`Failed to get database credentials for role '${role}': ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse the JSON response from vault read command
 */
function parseVaultResponse(output: string): DbCredentials {
  try {
    const response = parseJson(VAULT_DB_CREDS_RESPONSE_SCHEMA, output);

    return {
      username: response.data.username,
      password: response.data.password,
      leaseId: response.lease_id || '',
      leaseDuration: response.lease_duration || 0,
      data: response.data as Record<string, unknown>
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new CLIError(`Invalid Vault response format: ${error.message}`);
    }
    throw new CLIError(`Failed to parse Vault response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get database credentials and format as plain text output (similar to vault CLI)
 * 
 * @param options Configuration options
 * @returns Formatted string output
 */
export async function getDbCredsFormatted(options: GetDbCredsOptions): Promise<string> {
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