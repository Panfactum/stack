// This file defines the get-token command for HashiCorp Vault authentication
// It provides CLI access to Vault token retrieval with automatic refresh

import { Command, Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getVaultToken } from '@/util/vault/getVaultToken';

/**
 * CLI command for retrieving HashiCorp Vault authentication tokens
 * 
 * @remarks
 * This command provides a CLI interface for obtaining Vault tokens needed
 * for infrastructure operations. It handles the complete authentication
 * lifecycle including:
 * 
 * - Token reuse from environment variables
 * - Cached token retrieval
 * - Automatic token refresh when TTL is low
 * - OIDC authentication fallback
 * 
 * Token sources (in order of precedence):
 * 1. VAULT_TOKEN environment variable
 * 2. Cached token from vault credential helper
 * 3. Fresh OIDC login if no valid token exists
 * 
 * The command ensures tokens have at least 30 minutes of TTL remaining,
 * automatically refreshing when needed. This prevents authentication
 * failures during long-running operations.
 * 
 * @example
 * ```bash
 * # Get token using VAULT_ADDR from environment
 * export VAULT_TOKEN=$(pf vault get-token)
 * 
 * # Get token for specific Vault instance
 * pf vault get-token --address https://vault.prod.example.com
 * 
 * # Use in Terraform workflows
 * terraform apply -var="vault_token=$(pf vault get-token)"
 * ```
 * 
 * @see {@link getVaultToken} - The underlying token retrieval logic
 */
export class GetVaultTokenCommand extends PanfactumCommand {
  static override paths = [['vault', 'get-token']];

  static override usage = Command.Usage({
    description: 'Get a Vault authentication token for Terraform workflows',
    category: 'Vault',
    details: `
      This command retrieves a Vault authentication token, handling token refresh when needed.
      
      It will:
      - Use existing VAULT_TOKEN if set
      - Otherwise, try to get cached token from vault credential helper
      - Check token TTL and refresh if less than 30 minutes remaining
      - Fall back to OIDC login if no valid token exists
    `,
    examples: [
      ['Get a Vault token using VAULT_ADDR environment variable', 'pf vault get-token'],
      ['Get a Vault token for a specific address', 'pf vault get-token --address https://vault.example.com'],
      ['Get a token silently (exit 0 on failure)', 'pf vault get-token --silent'],
    ],
  });

  /** Vault server URL (optional, defaults to VAULT_ADDR) */
  address = Option.String('-a,--address', {
    description: 'The URL of the Vault cluster (defaults to VAULT_ADDR if not set)',
  });

  /** Silent mode - exit cleanly on failures */
  silent = Option.Boolean('-s,--silent', false, {
    description: 'Exit with 0 if failing to get the vault token',
  });

  /**
   * Executes the Vault token retrieval
   * 
   * @remarks
   * Retrieves a valid Vault token and outputs it to stdout with no
   * trailing newline. In silent mode, failures return exit code 0
   * instead of throwing errors, useful for optional authentication.
   * 
   * @returns Exit code (0 for success or silent failure)
   * 
   * @throws {@link CLIError}
   * Throws when token retrieval fails (unless in silent mode)
   */
  async execute() {
    try {
      const token = await getVaultToken({
        address: this.address,
        silent: this.silent,
        context: this.context,
      });

      // Output the token to stdout (matching bash script behavior)
      this.context.stdout.write(token);
      
      return 0;
    } catch (error) {
      // If silent mode is enabled, getVaultToken won't throw
      // So if we get here in silent mode, still return 0
      if (this.silent) {
        return 0;
      }
      // Otherwise, let the error propagate
      throw error;
    }
  }
}