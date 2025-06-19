import { input } from '@inquirer/prompts';
import { Option } from 'clipanion';
import { z } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getAllRegions } from "@/util/config/getAllRegions.ts";
import {CLIError, PanfactumZodError} from '@/util/error/error';
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
      ['Tunnel to specific service', '$0 tunnel --cluster production-primary --remote-address argo-server.argo:2746'],
      ['Tunnel with all options', '$0 tunnel --cluster production-primary --remote-address argo-server.argo:2746 --local-port 3333'],
    ],
  });

  cluster = Option.String('--cluster', {
    description: 'Name of the Cluster to tunnel through',
  });
  remoteAddress = Option.String('--remote-address,-r', {
    description: 'Remote address to tunnel to (e.g., service.namespace:port)',
  });
  localPort = Option.String('--local-port,-l', {
    description: 'Local port to bind to (optional, will prompt if not provided)',
  });

  override async execute(): Promise<number> {
    // Get kube contexts if needed
    const kubeContexts = await getKubeContextsFromConfig(this.context);

      // Get the kube context - either from option or prompt
      const selectedKubeContext = this.cluster
        ? kubeContexts.find(context => context.cluster === this.cluster)
        : await this.context.logger.select({
          message: "Select the Cluster to tunnel through:",
          choices: kubeContexts.map(context => ({
            value: context,
            name: `${context.name} (${context.cluster})`,
          })),
        });

      if (!selectedKubeContext) {
        throw new CLIError(`Cluster '${this.cluster}' not found.`);
      }

      const regions = (await getAllRegions(this.context)).filter(region => region.bastionDeployed)
      const selectedRegion = regions.find(region => region.clusterContextName === selectedKubeContext.name)

      if (!selectedRegion) {
        throw new CLIError(`No bastion found for cluster '${selectedKubeContext.cluster}'. Available bastions: ${regions.map(r => r.clusterContextName).join(', ')}`);
      }

      // Get remote address - either from option or prompt
      let remoteAddressValue: string;
      if (this.remoteAddress) {
        remoteAddressValue = this.remoteAddress;
      } else {
        remoteAddressValue = await input({
          message: 'Enter the remote address to tunnel to (e.g., service.namespace:port):',
          validate: (value) => {
            const result = remoteAddressSchema.safeParse(value);
            if (!result.success) {
              return result.error.errors[0]?.message || 'Invalid remote address';
            }
            return true;
          }
        });
      }

      // Validate remote address format
      const remoteAddressResult = remoteAddressSchema.safeParse(remoteAddressValue);
      if (!remoteAddressResult.success) {
        throw new PanfactumZodError(
          'Invalid remote address format',
          'remote address',
          remoteAddressResult.error
        );
      }

      // Determine local port
      let localPortNumber: number;
      if (this.localPort) {
        const localPortResult = portSchema.safeParse(this.localPort);
        if (!localPortResult.success) {
          throw new PanfactumZodError(
            'Invalid local port',
            'local port',
            localPortResult.error
          );
        }
        localPortNumber = localPortResult.data;
      } else {
        // Prompt for port
        const portString = await input({
          message: 'Enter a local port for the tunnel (1024-65535):',
          validate: (value) => {
            const result = portSchema.safeParse(value);
            if (!result.success) {
              return result.error.errors[0]?.message || 'Invalid port';
            }
            return true;
          }
        });
        const portResult = portSchema.safeParse(portString);
        if (!portResult.success) {
          throw new PanfactumZodError(
            'Invalid port number',
            'local port',
            portResult.error
          );
        }
        localPortNumber = portResult.data;
      }

      // Validate vault address
      if (!selectedRegion.vaultAddress) {
        throw new CLIError(`Vault address not configured for cluster ${selectedKubeContext.cluster}`);
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
  }
}