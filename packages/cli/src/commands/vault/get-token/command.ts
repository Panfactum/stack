import { Command, Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getVaultToken } from '@/util/vault/getVaultToken';

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

  address = Option.String('-a,--address', {
    description: 'The URL of the Vault cluster (defaults to VAULT_ADDR if not set)',
  });

  silent = Option.Boolean('-s,--silent', false, {
    description: 'Exit with 0 if failing to get the vault token',
  });

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