import { execSync } from 'child_process';

export interface GetVaultTokenOptions {
  address?: string;
  silent?: boolean;
  noop?: boolean;
}

export interface VaultTokenResult {
  token: string;
  isValid: boolean;
  error?: string;
}

/**
 * Get a Vault authentication token, handling token refresh when needed
 * 
 * @param options Configuration options
 * @returns Vault token result
 */
export async function getVaultToken(options: GetVaultTokenOptions = {}): Promise<VaultTokenResult> {
  const { address, silent = false, noop = false } = options;

  // Handle noop mode
  if (noop) {
    return { token: '', isValid: true };
  }

  try {
    // Set vault address
    const vaultAddr = address || process.env['VAULT_ADDR'];
    
    if (!vaultAddr) {
      throw new Error('VAULT_ADDR is not set. Either set the env variable or use the --address flag.');
    }

    // Handle special terragrunt case
    if (vaultAddr === '@@TERRAGRUNT_INVALID@@') {
      if (!silent) {
        throw new Error('Vault provider is enabled but vault_addr is not set.');
      }
      return { token: 'invalid_token', isValid: false };
    }

    // Set environment for vault commands
    const env = { ...process.env, VAULT_ADDR: vaultAddr };

    // Check for existing token in environment
    if (process.env['VAULT_TOKEN']) {
      return { token: process.env['VAULT_TOKEN'], isValid: true };
    }

    // Try to get existing token from vault credential helper
    let existingToken: string | null = null;
    try {
      existingToken = execSync('vault print token', { 
        env, 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'] 
      }).trim();
    } catch {
      // No existing token, will need to login
    }

    if (existingToken) {
      // Check token TTL
      try {
        const lookupResult = execSync('vault token lookup -format=json', {
          env: { ...env, VAULT_TOKEN: existingToken },
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        const lookupData = JSON.parse(lookupResult) as { data: { ttl: string } };
        const ttl = parseInt(lookupData.data.ttl);

        // If token has more than 30 minutes left, use it
        if (ttl >= 1800) {
          return { token: existingToken, isValid: true };
        }
      } catch {
        // Token lookup failed, need new token
      }
    }

    // Perform OIDC login to get new token
    const token = performOIDCLogin(env);
    return { token, isValid: true };

  } catch (error) {
    if (silent) {
      // In silent mode, return invalid token and don't throw
      if (process.env['VAULT_ADDR'] !== '@@TERRAGRUNT_INVALID@@') {
        // In Node.js environment, console is globally available
        // eslint-disable-next-line no-undef
        console.error('Warning: pf-get-vault-token failed, but exiting with 0 as --silent is enabled.');
      }
      return { token: 'invalid_token', isValid: false };
    }
    
    throw error;
  }
}

/**
 * Perform OIDC login to get a new Vault token
 */
function performOIDCLogin(env: Record<string, string | undefined>): string {
  try {
    const token = execSync('vault login -method=oidc -field=token', {
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (!token) {
      throw new Error('Failed to get token from OIDC login');
    }

    return token;
  } catch (error) {
    throw new Error(`Vault OIDC login failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convenience function to get just the token string, throwing on error
 */
export async function getVaultTokenString(options: GetVaultTokenOptions = {}): Promise<string> {
  const result = await getVaultToken(options);
  
  if (!result.isValid) {
    throw new Error(result.error || 'Failed to get valid Vault token');
  }
  
  return result.token;
}