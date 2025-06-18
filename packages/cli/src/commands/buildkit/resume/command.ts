import { Option } from 'clipanion'
import { z } from 'zod'
import { type Architecture, architectureSchema } from '@/util/buildkit/constants.js'
import { scaleUpBuildKit } from '@/util/buildkit/scaleUp.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'

// Zod schemas for input validation
const timeoutSchema = z.string().regex(/^\d+$/, 'Timeout must be a positive integer').transform(Number)

export default class BuildkitScaleUpCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'scale', 'up']]

  static override usage = PanfactumCommand.Usage({
    description: 'Scales up BuildKit from 0. Helper to be used prior to a build.',
    category: 'BuildKit',
  })

  only = Option.String('--only', {
    description: 'If provided, will only scale up the BuildKit instance for the provided architecture. Otherwise, will scale up all architectures.'
  })

  wait = Option.Boolean('--wait', false, {
    description: 'If provided, will wait for the scale-up to complete before exiting.'
  })

  timeout = Option.String('--timeout', '600', {
    description: 'Timeout in seconds to wait for scale-up to complete (default: 600)'
  })

  kubectlContext = Option.String('--context', {
    description: 'The kubectl context to use for interacting with Kubernetes'
  })

  async execute(): Promise<number> {
    // Validate architecture if provided and get properly typed value
    let architectures: Architecture[] | undefined
    if (this.only) {
      const validatedOnly = architectureSchema.parse(this.only)
      architectures = [validatedOnly]
    }

    const timeoutSeconds = timeoutSchema.parse(this.timeout)

    await scaleUpBuildKit({
      context: this.context,
      architectures,
      kubectlContext: this.kubectlContext,
      wait: this.wait,
      timeoutSeconds
    })

    return 0
  }
}