import { Option } from 'clipanion'
import { getBuildKitConfig } from '@/util/buildkit/config.js'
import { type Architecture, architectures } from '@/util/buildkit/constants.js'
import { getBuildKitAddress } from '@/util/buildkit/getAddress.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { execute } from '@/util/subprocess/execute.js'

export default class BuildkitTunnelCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'tunnel']]

  static override usage = PanfactumCommand.Usage({
    description: 'Sets up a network tunnel from the local host to a remote BuildKit server'
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
    // Validate architecture
    if (!architectures.includes(this.arch as Architecture)) {
      this.context.logger.error(`--arch must be one of: ${architectures.join(', ')}`)
      return 1
    }

    // Validate port
    const portNum = parseInt(this.port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      this.context.logger.error('Please provide a valid port number')
      return 1
    }

    // Get BuildKit configuration
    const config = await getBuildKitConfig(this.context)

    // Validate context exists
    try {
      await execute({
        command: ['kubectl', 'config', 'get-contexts', config.cluster],
        context: this.context,
        workingDirectory: process.cwd()
      })
    } catch {
      this.context.logger.error(`'${config.cluster}' not found in kubeconfig. Run pf-update-kube to regenerate kubeconfig.`)
      return 1
    }

    // Scale up the BuildKit instance
    await execute({
      command: [
        'pf',
        'buildkit',
        'scale',
        'up',
        '--only',
        this.arch,
        '--wait',
        '--context',
        config.cluster
      ],
      context: this.context,
      workingDirectory: process.cwd()
    })

    // Get the address of a free instance
    const address = await getBuildKitAddress({
      arch: this.arch as Architecture,
      kubectlContext: config.cluster,
      omitProtocol: true,
      context: this.context
    })

    // Run the tunnel
    await execute({
      command: [
        'pf-tunnel',
        '--bastion',
        config.bastion,
        '--remote-address',
        address,
        '--local-port',
        this.port
      ],
      context: this.context,
      workingDirectory: process.cwd()
    })

    return 0
  }
}