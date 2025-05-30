// Records the current timestamp as an annotation on the BuildKit StatefulSet
// Used to track when builds occur for monitoring and scaling purposes

import { Command, Option } from 'clipanion'
import { recordBuildKitBuild } from '@/util/buildkit/recordBuild.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import type { Architecture } from '@/util/buildkit/constants.js'

export class RecordBuildCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'record-build']]

  static override usage = Command.Usage({
    category: 'BuildKit',
    description: 'Record the current timestamp on the BuildKit StatefulSet',
    details:
      'Annotates the BuildKit StatefulSet with the current timestamp to track when builds occur. ' +
      'This information is used for monitoring build frequency and automatic scaling decisions.',
    examples: [
      ['Record a build on AMD64 BuildKit', '$0 buildkit record-build --arch amd64'],
      ['Record a build on ARM64 BuildKit', '$0 buildkit record-build --arch arm64']
    ]
  })

  arch = Option.String('--arch', {
    required: true,
    description: 'The CPU architecture (amd64 or arm64)'
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

    await recordBuildKitBuild({
      arch: this.arch as Architecture,
      kubectlContext: this.kubectlContext,
      context: this.context
    })

    this.context.stdout.write(`Successfully recorded build timestamp for ${this.arch} BuildKit\n`)
    return 0
  }
}