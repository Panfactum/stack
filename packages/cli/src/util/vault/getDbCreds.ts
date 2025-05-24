import { execSync } from 'child_process';
import { getVaultTokenString } from './getToken';

export interface GetDbCredsOptions {
  role: string;
  vaultAddress?: string;
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
export async function getDbCreds(options: GetDbCredsOptions): Promise<DbCredentials> {
  const { role, vaultAddress } = options;

  if (!role) {
    throw new Error('role is a required argument.');
  }

  // Set up environment
  const env = { ...process.env };
  if (vaultAddress) {
    env['VAULT_ADDR'] = vaultAddress;
  }

  // Get Vault token
  const token = await getVaultTokenString({ address: vaultAddress });
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
    throw new Error(`Failed to get database credentials for role '${role}': ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse the JSON response from vault read command
 */
function parseVaultResponse(output: string): DbCredentials {
  try {
    const response = JSON.parse(output) as {
      data?: {
        username?: string;
        password?: string;
        [key: string]: unknown;
      };
      lease_id?: string;
      lease_duration?: number;
    };
    
    if (!response.data || !response.data.username || !response.data.password) {
      throw new Error('Invalid response format from Vault');
    }

    return {
      username: response.data.username,
      password: response.data.password,
      leaseId: response.lease_id || '',
      leaseDuration: response.lease_duration || 0,
      data: response.data as Record<string, unknown>
    };
  } catch (error) {
    throw new Error(`Failed to parse Vault response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get database credentials and format as plain text output (similar to vault CLI)
 * 
 * @param options Configuration options
 * @returns Formatted string output
 */
export async function getDbCredsFormatted(options: GetDbCredsOptions): Promise<string> {
  const creds = await getDbCreds(options);
  
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