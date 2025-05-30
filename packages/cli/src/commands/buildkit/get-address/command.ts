// Gets the address of the least-used BuildKit pod for a specific architecture
// Used by CI/CD pipelines to load balance builds across BuildKit instances

import { Command, Option } from 'clipanion'
import { getBuildKitAddress } from '@/util/buildkit/getAddress.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import type { Architecture } from '@/util/buildkit/constants.js'

export class GetAddressCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'get-address']]

  static override usage = Command.Usage({
    category: 'BuildKit',
    description: 'Get the address of the least-used BuildKit pod for a specific architecture',
    details:
      'Returns the address of a BuildKit pod that has the lowest CPU usage for the specified architecture. ' +
      'This helps distribute build load across multiple BuildKit instances.',
    examples: [
      ['Get AMD64 BuildKit address', '$0 buildkit get-address --arch amd64'],
      ['Get ARM64 BuildKit address without protocol', '$0 buildkit get-address --arch arm64 --omit-protocol']
    ]
  })

  arch = Option.String('--arch', {
    required: true,
    description: 'The CPU architecture (amd64 or arm64)'
  })

  omitProtocol = Option.Boolean('--omit-protocol', {
    description: 'Omit the tcp:// protocol prefix from the address'
  })

  kubectlContext = Option.String('--context', {
    description: 'The kubectl context to use for interacting with Kubernetes'
  })

  async execute(): Promise<number> {
    // Validate architecture
    if (this.arch !== 'amd64' && this.arch !== 'arm64') {
      this.context.logger.error('Architecture must be either amd64 or arm64')
      return 1
    }

    const address = await getBuildKitAddress({
      arch: this.arch as Architecture,
      kubectlContext: this.kubectlContext,
      omitProtocol: this.omitProtocol,
      context: this.context
    })

    this.context.stdout.write(address + '\n')
    return 0
  }
}