import { CLIError } from '@/util/error/error';
import { execute } from '@/util/subprocess/execute';
import type { PanfactumContext } from '@/util/context/context';

export interface GetVaultTokenOptions {
  address?: string;
  silent?: boolean;
  noop?: boolean;
  context: PanfactumContext;
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
export async function getVaultToken(options: GetVaultTokenOptions): Promise<VaultTokenResult> {
  const { address, silent = false, noop = false, context } = options;

  // Handle noop mode
  if (noop) {
    return { token: '', isValid: true };
  }

  try {
    // Set vault address
    const vaultAddr = address;
    
    if (!vaultAddr) {
      throw new CLIError('VAULT_ADDR is not set. Either set the env variable or use the --address flag.');
    }

    // Handle special terragrunt case
    if (vaultAddr === '@@TERRAGRUNT_INVALID@@') {
      if (!silent) {
        throw new CLIError('Vault provider is enabled but VAULT_ADDR is not set.');
      }
      return { token: 'invalid_token', isValid: false };
    }

    // Check for existing token in environment
    if (context.env['VAULT_TOKEN']) {
      return { token: context.env['VAULT_TOKEN'], isValid: true };
    }

    // Set environment for vault commands
    const env = { ...context.env, VAULT_ADDR: vaultAddr };

    // Try to get existing token from vault credential helper
    let existingToken: string | null = null;
    try {
      const result = await execute({
        command: ['vault', 'print', 'token'],
        context,
        workingDirectory: context.repoVariables.repo_root,
        env
      });
      existingToken = result.stdout.trim();
    } catch {
      // No existing token, will need to login
    }

    if (existingToken) {
      // Check token TTL
      try {
        const lookupResult = await execute({
          command: ['vault', 'token', 'lookup', '-format=json'],
          context,
          workingDirectory: context.repoVariables.repo_root,
          env: { ...env, VAULT_TOKEN: existingToken }
        });
        
        const lookupData = JSON.parse(lookupResult.stdout) as { data: { ttl: string } };
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
    const token = await performOIDCLogin(env, context);
    return { token, isValid: true };

  } catch (error) {
    if (silent) {
      // In silent mode, return invalid token and don't throw
      if (context.env['VAULT_ADDR'] !== '@@TERRAGRUNT_INVALID@@') {
        // In Node.js environment, console is globally available
        // eslint-disable-next-line no-undef
        console.error('Warning: getVaultToken failed, but exiting with 0 as --silent is enabled.');
      }
      return { token: 'invalid_token', isValid: false };
    }
    
    throw error;
  }
}

/**
 * Perform OIDC login to get a new Vault token
 */
async function performOIDCLogin(env: Record<string, string | undefined>, context: PanfactumContext): Promise<string> {
  try {
    const result = await execute({
      command: ['vault', 'login', '-method=oidc', '-field=token'],
      context,
      workingDirectory: context.repoVariables.repo_root,
      env
    });

    const token = result.stdout.trim();
    if (!token) {
      throw new CLIError('Failed to get token from OIDC login');
    }

    return token;
  } catch (error) {
    throw new CLIError(`Vault OIDC login failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convenience function to get just the token string, throwing on error
 */
export async function getVaultTokenString(options: GetVaultTokenOptions): Promise<string> {
  const result = await getVaultToken(options);
  
  if (!result.isValid) {
    throw new CLIError(result.error || 'Failed to get valid Vault token');
  }
  
  return result.token;
}