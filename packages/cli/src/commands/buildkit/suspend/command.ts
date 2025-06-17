import { Option } from 'clipanion'
import { z } from 'zod'
import { type Architecture, BUILDKIT_NAMESPACE, BUILDKIT_STATEFULSET_NAME_PREFIX, architectures } from '@/util/buildkit/constants.js'
import { getLastBuildTime } from '@/util/buildkit/getLastBuildTime.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { getAllRegions } from '@/util/config/getAllRegions.js'
import { getKubectlContextArgs } from '@/util/kube/getKubectlContextArgs.js'
import { execute } from '@/util/subprocess/execute.js'

export default class BuildkitScaleDownCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'suspend']]

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
      const timeoutSchema = z.string().regex(/^\d+$/, 'Timeout must be a positive integer').transform(Number);
      timeoutSeconds = timeoutSchema.parse(this.timeout);
    }

    // Validate context if provided
    if (this.kubectlContext) {
      const allRegions = await getAllRegions(this.context)
      const matchingRegion = allRegions.find(region => region.clusterContextName === this.kubectlContext)

      if (!matchingRegion) {
        this.context.logger.error(`'${this.kubectlContext}' not found in any configured region.`)
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
    const contextArgs = getKubectlContextArgs(this.kubectlContext)

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