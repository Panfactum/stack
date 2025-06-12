import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { input } from '@inquirer/prompts';
import { Option } from 'clipanion';
import { z, ZodError } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getAllRegions } from "@/util/config/getAllRegions.ts";
import { CLIError, PanfactumZodError } from '@/util/error/error';
import { execute } from '@/util/subprocess/execute';
import { getVaultTokenString } from '@/util/vault/getVaultToken';

// Zod schema for port validation
const portSchema = z.string()
  .regex(/^\d+$/, 'Port must be a number')
  .transform(Number)
  .refine((port) => port >= 1024 && port <= 65535, {
    message: 'Port must be between 1024 and 65535'
  });

// Zod schema for remote address validation (hostname:port format)
const remoteAddressSchema = z.string()
  .regex(/^.+:\d+$/, 'Remote address must include both hostname and port (e.g., example.com:443)')
  .refine((address) => {
    const parts = address.split(':');
    if (parts.length !== 2) return false;
    const [hostname, portStr] = parts;
    const port = parseInt(portStr!, 10);
    return hostname!.length > 0 && !isNaN(port) && port > 0 && port <= 65535;
  }, {
    message: 'Remote address must have a valid hostname and port number (1-65535)'
  });

export default class TunnelCommand extends PanfactumCommand {
  static override paths = [['tunnel']];

  static override usage = PanfactumCommand.Usage({
    description: 'Establish SSH tunnel to internal network services through a bastion host',
    details: `
      This command starts a tunnel to an internal network service to allow network connectivity 
      during local development.
    `,
    examples: [
      ['Tunnel to argo', '$0 tunnel production-primary argo-server.argo:2746'],
      ['Tunnel to argo with local port', '$0 tunnel production-primary argo-server.argo:2746 --local-port 3333'],
    ],
  });

  bastion = Option.String({ required: true });
  remoteAddress = Option.String({ required: true });
  localPort = Option.String('--local-port', '-l', {
    description: 'Local port to bind to (optional, will prompt if not provided)',
  });

  override async execute(): Promise<number> {
    try {
      const { repoVariables } = this.context;
      const sshDir = repoVariables.ssh_dir;
      
      // Validate remote address format
      remoteAddressSchema.parse(this.remoteAddress);

      const regions = (await getAllRegions(this.context)).filter(region => region.bastionDeployed)

      const selectedRegion = regions.find(region => region.clusterContextName === this.bastion)

      if (!selectedRegion) {
        throw new CLIError(`No bastion found with name '${this.bastion}'. Available bastions: ${regions.map(r => r.clusterContextName).join(', ')}`);
      }

      // Read connection info
      const connectionInfoFile = join(sshDir, 'connection_info');
      if (!existsSync(connectionInfoFile)) {
        throw new CLIError(
          `Connection info file not found at ${connectionInfoFile}. Run pf devshell sync to generate it.`
        );
      }

      const connectionInfo = readFileSync(connectionInfoFile, 'utf8');
      const bastionLine = connectionInfo.split('\n').find(line => line.startsWith(`${this.bastion} `));
      
      if (!bastionLine) {
        throw new CLIError(
          `${this.bastion} not found in ${connectionInfoFile}. Ensure this name is correct or run pf devshell sync to regenerate this file.`
        );
      }

      const [, bastionDomain, bastionPort] = bastionLine.split(' ');
      if (!bastionDomain || !bastionPort) {
        throw new CLIError(`Invalid connection info format for ${this.bastion}`);
      }

      // Setup SSH keys
      const keyFile = join(sshDir, `id_ed25519_${this.bastion}`);
      const publicKeyFile = `${keyFile}.pub`;
      const signedPublicKeyFile = `${keyFile}_signed.pub`;

      // Generate keys if they don't exist
      if (!existsSync(keyFile) || !existsSync(publicKeyFile) || !existsSync(signedPublicKeyFile)) {
        this.context.logger.info('Generating SSH keys...');
        
        // Clean up any partial keys
        for (const file of [keyFile, publicKeyFile, signedPublicKeyFile]) {
          if (existsSync(file)) {
            await execute({
              command: ['rm', '-f', file],
              context: this.context,
              workingDirectory: process.cwd(),
            });
          }
        }

        // Generate new keys
        await execute({
          command: [
            'ssh-keygen',
            '-q',
            '-t', 'ed25519',
            '-N', '',
            '-C', this.bastion,
            '-f', keyFile
          ],
          context: this.context,
          workingDirectory: process.cwd(),
        });
      }

      // Sign SSH key with Vault
      const vaultToken = await getVaultTokenString({ context: this.context, address: selectedRegion.vaultAddress });

      const { stdout: signedKey } = await execute({
        command: [
          'vault',
          'write',
          '-field',
          'signed_key',
          'ssh/sign/default',
          `public_key=@${publicKeyFile}`
        ],
        context: this.context,
        workingDirectory: process.cwd(),
        env: {
          ...process.env,
          VAULT_ADDR: selectedRegion.vaultAddress,
          VAULT_TOKEN: vaultToken
        }
      });

      this.context.logger.info('SSH Key signed successfully');

      writeFileSync(signedPublicKeyFile, signedKey);

      // Determine local port
      let localPortNumber: number;
      if (this.localPort) {
        localPortNumber = portSchema.parse(this.localPort);
      } else {
        // Prompt for port
        const portString = await input({
          message: 'Enter a local port for the tunnel (1024-65535):',
          validate: (value) => {
            try {
              portSchema.parse(value);
              return true;
            } catch (error) {
              if (error instanceof z.ZodError) {
                return error.errors[0]?.message || 'Invalid port';
              }
              return 'Invalid port';
            }
          }
        });
        localPortNumber = portSchema.parse(portString);
      }

      // Establish tunnel
      const knownHostsFile = join(sshDir, 'known_hosts');
      
      // Use spawn to run autossh in the foreground
      const autossh = spawn('autossh', [
        '-M', '0',
        '-o', `UserKnownHostsFile=${knownHostsFile}`,
        '-o', 'IdentitiesOnly=yes',
        '-o', 'IdentityAgent=none',
        '-o', 'ServerAliveInterval=2',
        '-o', 'ServerAliveCountMax=3',
        '-o', 'ConnectTimeout=1',
        '-N',
        '-i', keyFile,
        '-i', signedPublicKeyFile,
        '-L', `127.0.0.1:${localPortNumber}:${this.remoteAddress}`,
        '-p', bastionPort,
        `panfactum@${bastionDomain}`
      ], {
        env: {
          ...process.env,
          AUTOSSH_GATETIME: '0'
        },
        stdio: 'inherit'
      });

      this.context.logger.info(
        `Tunnel established: localhost:${localPortNumber} → ${this.remoteAddress} via ${this.bastion}`
      );

      this.context.logger.info(`Press Ctrl+C to close the tunnel.`);

      // Handle process termination
      process.on('SIGINT', () => {
        this.context.logger.info('Closing tunnel...');
        autossh.kill('SIGTERM');
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        autossh.kill('SIGTERM');
        process.exit(0);
      });

      // Wait for autossh to exit
      return new Promise((resolve) => {
        autossh.on('exit', (code) => {
          resolve(code || 0);
        });
      });

    } catch (error) {
      if (error instanceof ZodError) {
        throw new PanfactumZodError(
          'Invalid input provided for tunnel command',
          'tunnel command',
          error
        );
      }
      throw new CLIError(`Failed to establish tunnel: ${(error as Error).message}`, error);
    }
  }
}