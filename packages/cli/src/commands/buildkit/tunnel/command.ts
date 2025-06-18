import { Option } from 'clipanion'
import {z} from "zod";
import { getBuildKitConfig } from '@/util/buildkit/config.js'
import { architectureSchema } from '@/util/buildkit/constants.js'
import { getBuildKitAddress } from '@/util/buildkit/getAddress.js'
import { scaleUpBuildKit } from '@/util/buildkit/scaleUp.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { getAllRegions } from '@/util/config/getAllRegions.js'
import { CLIError } from '@/util/error/error.js'
import { createSSHTunnel } from '@/util/tunnel/createSSHTunnel.js'

// Zod schema for port validation
const portSchema = z.string()
  .regex(/^\d+$/, 'Port must be a number')
  .transform(Number)
  .refine((port) => port >= 1 && port <= 65535, {
    message: 'Port must be between 1 and 65535'
  })

export default class BuildkitTunnelCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'tunnel']]

  static override usage = PanfactumCommand.Usage({
    description: 'Sets up a network tunnel from the local host to a remote BuildKit server',
    category: 'BuildKit',
  })

  arch = Option.String('--arch', {
    required: true,
    description: 'The CPU architecture of the BuildKit instance to connect with (amd64 or arm64)'
  })

  port = Option.String('--port', {
    required: true,
    description: 'The local port to bind the tunnel to'
  })

  async execute(): Promise<number> {
    // Validate and get properly typed architecture
    const validatedArch = architectureSchema.parse(this.arch)

    // Validate port
    const portNum = portSchema.parse(this.port)

    // Get BuildKit configuration
    const config = await getBuildKitConfig(this.context)


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