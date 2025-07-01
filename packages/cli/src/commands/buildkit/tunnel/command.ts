// This command creates SSH tunnels to remote BuildKit instances
// It handles scaling, address discovery, and tunnel lifecycle management

import { Option } from 'clipanion'
import {z} from "zod";
import { getBuildKitConfig } from '@/util/buildkit/config.js'
import { architectureSchema } from '@/util/buildkit/constants.js'
import { getBuildKitAddress } from '@/util/buildkit/getAddress.js'
import { scaleUpBuildKit } from '@/util/buildkit/scaleUp.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { getAllRegions } from '@/util/config/getAllRegions.js'
import { CLIError, PanfactumZodError } from '@/util/error/error.js'
import { createSSHTunnel } from '@/util/tunnel/createSSHTunnel.js'

/**
 * Schema for validating port numbers
 * 
 * @remarks
 * Validates that the port string contains only digits and is within
 * the valid TCP port range (1-65535). The schema transforms the
 * string to a number for use in the tunnel configuration.
 * 
 * @example
 * ```typescript
 * const validPort = portSchema.parse('8080'); // Returns 8080
 * const invalidPort = portSchema.parse('70000'); // Throws error
 * ```
 */
const portSchema = z.string()
  .regex(/^\d+$/, 'Port must be a number')
  .transform(Number)
  .refine((port) => port >= 1 && port <= 65535, {
    message: 'Port must be between 1 and 65535'
  })
  .describe('Local port number for BuildKit tunnel')

/**
 * Command for establishing SSH tunnels to BuildKit instances
 * 
 * @remarks
 * This command creates secure SSH tunnels to remote BuildKit instances
 * running in Kubernetes. It handles the complete tunnel lifecycle:
 * 
 * - Validates architecture and port parameters
 * - Retrieves BuildKit cluster configuration
 * - Scales up BuildKit deployment if needed
 * - Discovers available BuildKit instance addresses
 * - Establishes SSH tunnel through bastion host
 * - Maintains tunnel until interrupted
 * 
 * Key features:
 * - Architecture-specific instance selection
 * - Automatic scaling of BuildKit deployments
 * - Secure tunneling through SSH bastions
 * - Graceful cleanup on termination
 * - Integration with Vault for authentication
 * 
 * Prerequisites:
 * - BuildKit deployed in target Kubernetes cluster
 * - SSH bastion host configured and accessible
 * - Vault authentication configured
 * - Network access to bastion host
 * 
 * The tunnel remains active until interrupted (Ctrl+C),
 * making it suitable for:
 * - Local development with remote builds
 * - CI/CD pipeline integration
 * - Cross-architecture builds
 * - Resource-constrained environments
 * 
 * @example
 * ```bash
 * # Create tunnel to AMD64 BuildKit instance
 * pf buildkit tunnel --arch amd64 --port 8080
 * 
 * # Create tunnel to ARM64 instance on custom port
 * pf buildkit tunnel --arch arm64 --port 9090
 * 
 * # Use in background for scripting
 * pf buildkit tunnel --arch amd64 --port 8080 &
 * TUNNEL_PID=$!
 * # ... use tunnel ...
 * kill $TUNNEL_PID
 * ```
 * 
 * @see {@link createSSHTunnel} - For SSH tunnel creation
 * @see {@link scaleUpBuildKit} - For BuildKit scaling
 * @see {@link getBuildKitAddress} - For instance discovery
 */
export default class BuildkitTunnelCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'tunnel']]

  static override usage = PanfactumCommand.Usage({
    description: 'Sets up a network tunnel from the local host to a remote BuildKit server',
    category: 'BuildKit',
    details: `
Creates an SSH tunnel to a remote BuildKit instance for building container images.

This command:
1. Validates the target architecture (amd64 or arm64)
2. Ensures BuildKit instances are running for the architecture
3. Discovers an available BuildKit instance address
4. Establishes an SSH tunnel through the configured bastion
5. Maintains the tunnel until interrupted

The tunnel allows local buildctl or Docker clients to connect to remote
BuildKit instances as if they were running locally.
    `,
    examples: [
      [
        'Create AMD64 tunnel',
        'pf buildkit tunnel --arch amd64 --port 8080'
      ],
      [
        'Create ARM64 tunnel',
        'pf buildkit tunnel --arch arm64 --port 9090'
      ]
    ]
  })

  /**
   * CPU architecture of the target BuildKit instance
   * 
   * @remarks
   * Must be either 'amd64' or 'arm64'. This determines which
   * BuildKit deployment to connect to, allowing for cross-architecture
   * builds from any host system.
   */
  arch = Option.String('--arch', {
    required: true,
    description: 'The CPU architecture of the BuildKit instance to connect with (amd64 or arm64)'
  })

  /**
   * Local port to bind the tunnel
   * 
   * @remarks
   * The port on localhost where the BuildKit instance will be
   * accessible. Choose a port that doesn't conflict with other
   * local services.
   */
  port = Option.String('--port', {
    required: true,
    description: 'The local port to bind the tunnel to'
  })

  /**
   * Executes the tunnel creation command
   * 
   * @remarks
   * This method performs the following steps:
   * 1. Validates architecture and port parameters
   * 2. Retrieves BuildKit and bastion configuration
   * 3. Scales up BuildKit deployment for the architecture
   * 4. Discovers an available BuildKit instance
   * 5. Resolves bastion and Vault configuration
   * 6. Creates SSH tunnel through bastion
   * 7. Maintains tunnel until process termination
   * 
   * The method sets up signal handlers to ensure graceful
   * cleanup when the process is interrupted. The tunnel
   * remains active indefinitely until terminated.
   * 
   * @returns Promise that never resolves (process exits on termination)
   * 
   * @throws {@link PanfactumZodError}
   * Throws when architecture or port validation fails
   * 
   * @throws {@link CLIError}
   * Throws when bastion not found or Vault not configured
   */
  async execute(): Promise<number> {
    // Validate and get properly typed architecture
    const archResult = architectureSchema.safeParse(this.arch)
    if (!archResult.success) {
      throw new PanfactumZodError('Invalid architecture value', 'architecture', archResult.error);
    }
    const validatedArch = archResult.data

    // Validate port
    const portResult = portSchema.safeParse(this.port)
    if (!portResult.success) {
      throw new PanfactumZodError('Invalid port value', 'port', portResult.error);
    }
    const portNum = portResult.data

    // Get BuildKit configuration
    const config = await getBuildKitConfig({ context: this.context })


    // Scale up the BuildKit instance
    await scaleUpBuildKit({
      context: this.context,
      architectures: [validatedArch],
      kubectlContext: config.cluster,
      wait: true
    })

    // Get the address of a free instance
    const address = await getBuildKitAddress({
      arch: validatedArch,
      kubectlContext: config.cluster,
      omitProtocol: true,
      context: this.context
    })

    // Get region info for vault address
    const regions = (await getAllRegions(this.context)).filter(region => region.bastionDeployed)
    const selectedRegion = regions.find(region => region.clusterContextName === config.bastion)

    if (!selectedRegion) {
      throw new CLIError(`No bastion found with name '${config.bastion}'. Available bastions: ${regions.map(r => r.clusterContextName).join(', ')}`)
    }

    if (!selectedRegion.vaultAddress) {
      throw new CLIError(`Vault address not configured for region ${config.bastion}`)
    }

    // Create SSH tunnel
    const tunnelHandle = await createSSHTunnel({
      context: this.context,
      bastionName: config.bastion,
      remoteAddress: address,
      localPort: portNum,
      vaultAddress: selectedRegion.vaultAddress
    })

    this.context.logger.info(`BuildKit tunnel established on localhost:${portNum}`)
    this.context.logger.info(`Press Ctrl+C to close the tunnel.`)

    // Handle process termination
    const cleanup = async () => {
      await tunnelHandle.close()
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    // Keep the command running until terminated
    return new Promise(() => {
      // This promise never resolves naturally - it waits for process termination
      // The cleanup handlers above will exit the process
    })
  }
}