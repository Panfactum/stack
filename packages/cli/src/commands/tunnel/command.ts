import { input } from '@inquirer/prompts';
import { Option } from 'clipanion';
import { z, ZodError } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getAllRegions } from "@/util/config/getAllRegions.ts";
import { CLIError, PanfactumZodError } from '@/util/error/error';
import { getKubeContextsFromConfig } from "@/util/kube/getKubeContextsFromConfig.ts";
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
    description: 'Establish SSH tunnel to internal network services',
    category: 'Tunnel',
    details: `
      This command starts a tunnel to an internal network service to allow network connectivity 
      during local development.
    `,
    examples: [
      ['Tunnel with prompts', '$0 tunnel'],
      ['Tunnel to specific service', '$0 tunnel --kube-context production-primary argo-server.argo:2746'],
      ['Tunnel with all options', '$0 tunnel --kube-context production-primary argo-server.argo:2746 --local-port 3333'],
    ],
  });

  kubeContext = Option.String('--kube-context', {
    description: 'Name of the Kube Context to tunnel through',
  });
  remoteAddress = Option.String();
  localPort = Option.String('--local-port', '-l', {
    description: 'Local port to bind to (optional, will prompt if not provided)',
  });

  override async execute(): Promise<number> {
    try {
      // Get kube contexts if needed
      const kubeContexts = await getKubeContextsFromConfig(this.context);
      
      // Get the kube context - either from option or prompt
      const selectedKubeContext = this.kubeContext
        ? kubeContexts.find(context => context.name === this.kubeContext)
        : await this.context.logger.select({
            message: "Select the Cluster context you want to tunnel through:",
            choices: kubeContexts.map(context => ({
              value: context,
              name: `${context.name}`,
            })),
          });

      if (!selectedKubeContext) {
        throw new CLIError(`Kube context '${this.kubeContext}' not found.`);
      }

      const regions = (await getAllRegions(this.context)).filter(region => region.bastionDeployed)
      const selectedRegion = regions.find(region => region.clusterContextName === selectedKubeContext.name)

      if (!selectedRegion) {
        throw new CLIError(`No bastion found for context '${selectedKubeContext.name}'. Available bastions: ${regions.map(r => r.clusterContextName).join(', ')}`);
      }

      // Get remote address - either from option or prompt
      let remoteAddressValue: string;
      if (this.remoteAddress) {
        remoteAddressValue = this.remoteAddress;
      } else {
        remoteAddressValue = await input({
          message: 'Enter the remote address to tunnel to (e.g., service.namespace:port):',
          validate: (value) => {
            try {
              remoteAddressSchema.parse(value);
              return true;
            } catch (error) {
              if (error instanceof z.ZodError) {
                return error.errors[0]?.message || 'Invalid remote address';
              }
              return 'Invalid remote address';
            }
          }
        });
      }

      // Validate remote address format
      remoteAddressSchema.parse(remoteAddressValue);

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
        throw new CLIError(`Vault address not configured for bastion ${selectedKubeContext.name}`);
      }

      // Create SSH tunnel
      const tunnelHandle = await createSSHTunnel({
        context: this.context,
        bastionName: selectedKubeContext.name,
        remoteAddress: remoteAddressValue,
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