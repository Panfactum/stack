// This file provides utilities for obtaining and managing HashiCorp Vault authentication tokens
// It handles token caching, validation, and OIDC-based authentication

import { z } from 'zod';
import { CLIError, CLISubprocessError } from '@/util/error/error';
import { parseJson } from '@/util/json/parseJson';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Schema for Vault token lookup response
 * 
 * @remarks
 * Validates the structure returned by `vault token lookup -format=json`.
 * The ttl field is coerced to a number for easier comparison since
 * Vault may return it as a string in some versions.
 */
const VAULT_TOKEN_LOOKUP_SCHEMA = z.object({
  data: z.object({
    /** Time to live in seconds (coerced from string if needed) */
    ttl: z.coerce.number()
  }).passthrough()
}).passthrough()
  .describe("Vault token lookup response schema");

/**
 * Options for retrieving a Vault authentication token
 */
export interface IGetVaultTokenOptions {
  /** Vault server address (optional, uses VAULT_ADDR env if not provided) */
  address?: string;
  /** Whether to suppress errors and warnings */
  silent?: boolean;
  /** Panfactum context for configuration and environment */
  context: PanfactumContext;
}

/**
 * Retrieves a valid HashiCorp Vault authentication token
 * 
 * @remarks
 * This function manages Vault authentication tokens with intelligent caching
 * and automatic renewal. It follows this process:
 * 
 * 1. **Environment Check**: First checks for VAULT_TOKEN in environment
 * 2. **Token Cache**: Attempts to retrieve cached token via `vault print token`
 * 3. **TTL Validation**: Checks if cached token has >30 minutes remaining
 * 4. **OIDC Login**: Performs fresh OIDC login if no valid token exists
 * 
 * Token management features:
 * - Reuses existing tokens when possible to avoid unnecessary logins
 * - Automatically refreshes tokens with <30 minutes TTL
 * - Handles Terragrunt placeholder values gracefully
 * - Supports silent mode for non-interactive environments
 * 
 * The function integrates with Vault's credential helper system,
 * which caches tokens securely on the local system.
 * 
 * @param options - Configuration for token retrieval
 * @returns Valid Vault authentication token
 * 
 * @example
 * ```typescript
 * // Get token using environment configuration
 * const token = await getVaultToken({
 *   context,
 *   silent: false
 * });
 * 
 * // Get token for specific Vault instance
 * const token = await getVaultToken({
 *   context,
 *   address: 'https://vault.example.com',
 *   silent: true
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when VAULT_ADDR is not set and no address provided
 * 
 * @throws {@link CLIError}
 * Throws when Vault provider is enabled but not configured (unless silent)
 * 
 * @throws {@link CLIError}
 * Throws when OIDC login fails
 * 
 * @see {@link performOIDCLogin} - Handles the OIDC authentication flow
 * @see {@link execute} - For running vault CLI commands
 */
export async function getVaultToken(options: IGetVaultTokenOptions): Promise<string> {
  const { address, silent = false, context } = options;

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
      throw new CLIError('Invalid VAULT_ADDR');
    }

    // Check for existing token in environment
    if (context.env['VAULT_TOKEN']) {
      return context.env['VAULT_TOKEN'];
    }

    // Set environment for vault commands
    const env = { ...context.env, VAULT_ADDR: vaultAddr };

    // Try to get existing token from vault credential helper
    let existingToken: string | null = null;
    const printResult = await context.subprocessManager.execute({
      command: ['vault', 'print', 'token'],
      workingDirectory: context.devshellConfig.repo_root,
      env
    }).exited.catch(() => null);

    if (printResult && printResult.exitCode === 0) {
      const trimmed = printResult.stdout.trim();
      if (trimmed) {
        existingToken = trimmed;
      }
    }

    if (existingToken) {
      // Check token TTL
      const lookupResult = await context.subprocessManager.execute({
        command: ['vault', 'token', 'lookup', '-format=json'],
        workingDirectory: context.devshellConfig.repo_root,
        env: { ...env, VAULT_TOKEN: existingToken }
      }).exited.catch(() => null);

      if (lookupResult && lookupResult.exitCode === 0) {
        try {
          const lookupData = parseJson(VAULT_TOKEN_LOOKUP_SCHEMA, lookupResult.stdout);
          const ttl = lookupData.data.ttl; // Now already a number from Zod coercion

          // If token has more than 30 minutes left, use it
          if (ttl >= 1800) {
            return existingToken;
          }
        } catch {
          // Invalid response format; need a new token
        }
      }
    }

    // In silent mode, don't attempt interactive OIDC login
    if (silent) {
      throw new CLIError('No valid Vault token available');
    }

    // Perform OIDC login to get new token
    const token = await performOIDCLogin(env, context);
    return token;

  } catch (error) {
    if (silent) {
      // In silent mode, log warning but don't throw
      if (context.env['VAULT_ADDR'] !== '@@TERRAGRUNT_INVALID@@') {
        context.logger.warn('getVaultToken failed, but continuing as --silent is enabled.');
      }
    }

    throw error;
  }
}

/**
 * Performs OIDC login to obtain a new Vault token
 * 
 * @internal
 * @remarks
 * This function executes `vault login -method=oidc` to authenticate
 * via OpenID Connect. The OIDC method typically opens a browser
 * window for the user to authenticate with their identity provider.
 * 
 * @param env - Environment variables including VAULT_ADDR
 * @param context - Panfactum context for command execution
 * @returns New Vault authentication token
 * 
 * @throws {@link CLIError}
 * Throws when OIDC login fails or returns empty token
 */
async function performOIDCLogin(env: Record<string, string | undefined>, context: PanfactumContext): Promise<string> {
  const command = ['vault', 'login', '-method=oidc', '-field=token'];
  const result = await context.subprocessManager.execute({
    command,
    workingDirectory: context.devshellConfig.repo_root,
    env,
    stdin: 'inherit',
    onStdErrNewline: (line) => {
      context.logger.writeRaw(line);
    },
  }).exited;

  if (result.exitCode !== 0) {
    throw new CLISubprocessError('Vault OIDC login failed', {
      command: command.join(' '),
      subprocessLogs: result.output,
      workingDirectory: context.devshellConfig.repo_root,
    });
  }

  const token = result.stdout.trim();
  if (!token) {
    throw new CLIError('Failed to get token from OIDC login');
  }

  return token;
}

