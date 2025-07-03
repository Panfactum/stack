// This file defines the tunnel command for creating secure SSH tunnels
// It provides local access to internal Kubernetes services through bastion hosts

import { input } from '@inquirer/prompts';
import { Option } from 'clipanion';
import { z } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getAllRegions } from "@/util/config/getAllRegions.ts";
import {CLIError, PanfactumZodError} from '@/util/error/error';
import { getKubeContexts } from "@/util/kube/getKubeContexts.ts";
import { createSSHTunnel } from '@/util/tunnel/createSSHTunnel';

/**
 * Zod schema for validating port numbers
 * 
 * @remarks
 * Ensures ports are within the user-accessible range (1024-65535).
 * Ports below 1024 require root privileges.
 */
const portSchema = z.string()
  .regex(/^\d+$/, 'Port must be a number')
  .transform(Number)
  .refine((port) => port >= 1024 && port <= 65535, {
    message: 'Port must be between 1024 and 65535'
  })
  .describe('Port number validation for user-accessible range');

/**
 * Zod schema for validating remote address format
 * 
 * @remarks
 * Validates hostname:port format for tunnel destinations.
 * Supports both service names and FQDNs.
 * 
 * @example
 * Valid formats:
 * - service.namespace:8080
 * - grafana.monitoring:3000
 * - internal-api.default.svc.cluster.local:443
 */
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
  })
  .describe('Remote address validation in hostname:port format');

/**
 * CLI command for establishing SSH tunnels to internal services
 * 
 * @remarks
 * This command creates secure SSH tunnels through bastion hosts to access
 * internal Kubernetes services during local development. It's essential for
 * accessing services that aren't exposed publicly.
 * 
 * Key features:
 * - Secure SSH tunneling through bastion hosts
 * - Automatic credential management via Vault
 * - Interactive or non-interactive operation
 * - Support for any TCP-based service
 * - Graceful cleanup on termination
 * 
 * Common use cases:
 * - Accessing internal dashboards (Grafana, ArgoCD, etc.)
 * - Database connections for local development
 * - API debugging without public exposure
 * - Service-to-service communication testing
 * 
 * The tunnel establishes:
 * 1. SSH connection to bastion host
 * 2. Port forward from bastion to internal service
 * 3. Local port binding for application access
 * 
 * Security considerations:
 * - Uses temporary SSH credentials from Vault
 * - All traffic encrypted through SSH
 * - Bastion hosts provide audit logging
 * - No permanent credentials stored locally
 * 
 * @example
 * ```bash
 * # Interactive tunnel creation
 * pf tunnel
 * 
 * # Tunnel to ArgoCD UI
 * pf tunnel --cluster prod-primary --remote-address argo-server.argo:2746 --local-port 8080
 * # Access at http://localhost:8080
 * 
 * # Tunnel to Grafana
 * pf tunnel --cluster staging --remote-address grafana.monitoring:3000
 * 
 * # Database connection
 * pf tunnel --cluster dev --remote-address postgres.database:5432 --local-port 5432
 * # Connect with: psql -h localhost -p 5432
 * ```
 * 
 * @see {@link createSSHTunnel} - Core tunnel creation logic
 * @see {@link getKubeContextsFromConfig} - For cluster discovery
 */
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

  /**
   * Kubernetes cluster name to tunnel through
   * 
   * @remarks
   * Must match a configured cluster with an available bastion host.
   * If not provided, will prompt with available options.
   */
  cluster = Option.String('--cluster', {
    description: 'Name of the Cluster to tunnel through',
  });
  
  /**
   * Remote service address in hostname:port format
   * 
   * @remarks
   * Can be a Kubernetes service name or FQDN.
   * Format: service.namespace:port or full.domain.name:port
   */
  remoteAddress = Option.String('--remote-address,-r', {
    description: 'Remote address to tunnel to (e.g., service.namespace:port)',
  });
  
  /**
   * Local port to bind the tunnel to
   * 
   * @remarks
   * Must be between 1024-65535. If not provided, will prompt.
   * Choose a port that doesn't conflict with local services.
   */
  localPort = Option.String('--local-port,-l', {
    description: 'Local port to bind to (optional, will prompt if not provided)',
  });

  /**
   * Executes the tunnel creation process
   * 
   * @remarks
   * This method:
   * 1. Validates or prompts for cluster selection
   * 2. Verifies bastion availability
   * 3. Validates or prompts for remote address
   * 4. Determines local port binding
   * 5. Establishes SSH tunnel through bastion
   * 6. Maintains tunnel until interrupted
   * 
   * The tunnel remains active until manually terminated with Ctrl+C.
   * All cleanup is handled automatically on termination.
   * 
   * @returns Promise that never resolves (waits for termination)
   * 
   * @throws {@link CLIError}
   * Throws when cluster not found or has no bastion
   * 
   * @throws {@link PanfactumZodError}
   * Throws when address or port validation fails
   */
  override async execute(): Promise<number> {
    // Get kube contexts if needed
    const kubeContexts = await getKubeContexts(this.context);

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