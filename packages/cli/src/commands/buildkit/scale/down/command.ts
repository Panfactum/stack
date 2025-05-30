import { Option } from 'clipanion'
import { type Architecture, BUILDKIT_NAMESPACE, BUILDKIT_STATEFULSET_NAME_PREFIX, architectures } from '@/util/buildkit/constants.js'
import { getLastBuildTime } from '@/util/buildkit/getLastBuildTime.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { execute } from '@/util/subprocess/execute.js'

export default class BuildkitScaleDownCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'scale', 'down']]

  static override usage = PanfactumCommand.Usage({
    description: 'Scales the BuildKit instances to 0 replicas.'
  })

  timeout = Option.String('--timeout', {
    description: 'If provided, will examine the last build annotation on each BuildKit StatefulSet and will only scale down if the specified number of seconds has elapsed since the last build.'
  })

  kubectlContext = Option.String('--context', {
    description: 'The kubectl context to use for interacting with Kubernetes'
  })

  async execute(): Promise<number> {
    // Validate timeout if provided
    let timeoutSeconds: number | undefined
    if (this.timeout) {
      timeoutSeconds = parseInt(this.timeout, 10)
      if (isNaN(timeoutSeconds) || timeoutSeconds < 0) {
        this.context.logger.error('Please provide a valid numeric argument for --timeout')
        return 1
      }
    }

    // Validate context if provided
    if (this.kubectlContext) {
      try {
        await execute({
          command: ['kubectl', 'config', 'get-contexts', this.kubectlContext],
          context: this.context,
          workingDirectory: process.cwd()
        })
      } catch {
        this.context.logger.error(`'${this.kubectlContext}' not found in kubeconfig.`)
        return 1
      }
    }

    // Scale down each architecture
    for (const arch of architectures) {
      await this.scaleDown(arch, timeoutSeconds)
    }

    return 0
  }

  private async scaleDown(arch: Architecture, timeoutSeconds?: number): Promise<void> {
    const statefulsetName = `${BUILDKIT_STATEFULSET_NAME_PREFIX}${arch}`
    const contextArgs = this.kubectlContext ? ['--context', this.kubectlContext] : []

    if (timeoutSeconds !== undefined) {
      // Check last build time
      const lastBuildTime = await getLastBuildTime({ arch, kubectlContext: this.kubectlContext, context: this.context })
      
      this.context.logger.info(`${arch}: The last recorded build was: ${lastBuildTime || '<none>'}`)

      if (lastBuildTime === null) {
        this.context.logger.info(`${arch}: No builds recorded. Scaling down...`)
      } else {
        const currentTime = Math.floor(Date.now() / 1000)
        const secondsSinceLastBuild = currentTime - lastBuildTime

        if (secondsSinceLastBuild > timeoutSeconds) {
          this.context.logger.info(`${arch}: Last build occurred over ${timeoutSeconds} seconds ago. Scaling down...`)
        } else {
          this.context.logger.info(`${arch}: Last build occurred less than ${timeoutSeconds} seconds ago. Skipping scale down.`)
          return
        }
      }
    }

    // Scale down
    await execute({
      command: [
        'kubectl',
        ...contextArgs,
        'scale',
        'statefulset',
        statefulsetName,
        '--namespace',
        BUILDKIT_NAMESPACE,
        '--replicas=0'
      ],
      context: this.context,
      workingDirectory: process.cwd()
    })
  }
}