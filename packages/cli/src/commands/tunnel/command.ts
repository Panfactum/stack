import { input } from '@inquirer/prompts';
import { Option } from 'clipanion';
import { z, ZodError } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getAllRegions } from "@/util/config/getAllRegions.ts";
import { CLIError, PanfactumZodError } from '@/util/error/error';
import { createSSHTunnel } from '@/util/tunnel/createSSHTunnel';

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
      // Validate remote address format
      remoteAddressSchema.parse(this.remoteAddress);

      const regions = (await getAllRegions(this.context)).filter(region => region.bastionDeployed)

      const selectedRegion = regions.find(region => region.clusterContextName === this.bastion)

      if (!selectedRegion) {
        throw new CLIError(`No bastion found with name '${this.bastion}'. Available bastions: ${regions.map(r => r.clusterContextName).join(', ')}`);
      }

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

      // Validate vault address
      if (!selectedRegion.vaultAddress) {
        throw new CLIError(`Vault address not configured for bastion ${this.bastion}`);
      }

      // Create SSH tunnel
      const tunnelHandle = await createSSHTunnel({
        context: this.context,
        bastionName: this.bastion,
        remoteAddress: this.remoteAddress,
        localPort: localPortNumber,
        vaultAddress: selectedRegion.vaultAddress
      });

      this.context.logger.info(`Press Ctrl+C to close the tunnel.`);

      // Handle process termination
      const cleanup = async () => {
        await tunnelHandle.close();
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      // Keep the command running until terminated
      return new Promise(() => {
        // This promise never resolves naturally - it waits for process termination
        // The cleanup handlers above will exit the process
      });

    } catch (error) {
      if (error instanceof ZodError) {
        throw new PanfactumZodError(
          'Invalid input provided for tunnel command',
          'tunnel command',
          error
        );
      }
      throw new CLIError(`Failed to establish tunnel`, error);
    }
  }
}