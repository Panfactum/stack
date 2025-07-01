import { Option } from 'clipanion'
import { z } from 'zod'
import { type Architecture, BUILDKIT_NAMESPACE, BUILDKIT_STATEFULSET_NAME_PREFIX, architectures } from '@/util/buildkit/constants.js'
import { getLastBuildTime } from '@/util/buildkit/getLastBuildTime.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { getAllRegions } from '@/util/config/getAllRegions.js'
import { PanfactumZodError } from '@/util/error/error.js'
import { getKubectlContextArgs } from '@/util/kube/getKubectlContextArgs.js'
import { execute } from '@/util/subprocess/execute.js'

/**
 * Command for scaling down BuildKit instances to zero replicas
 * 
 * @remarks
 * This command suspends BuildKit services by scaling their StatefulSets down
 * to 0 replicas, effectively stopping all BuildKit pods. This is useful for
 * cost optimization when builds are not actively needed.
 * 
 * Key features:
 * - Scales down all BuildKit architectures to 0 replicas
 * - Optional timeout-based suspension (only scale down after inactivity)
 * - Preserves persistent volumes and configuration
 * - Graceful handling of already-suspended instances
 * 
 * The command supports intelligent scaling decisions by checking the last
 * build timestamp annotation and only scaling down if sufficient time has
 * elapsed since the last build activity.
 * 
 * Use cases:
 * - Cost optimization during periods of inactivity
 * - Scheduled maintenance windows
 * - Resource cleanup in development environments
 * - Automated scaling based on usage patterns
 * 
 * @example
 * ```bash
 * # Immediately suspend all BuildKit instances
 * pf buildkit suspend
 * 
 * # Only suspend if no builds in the last 30 minutes (1800 seconds)
 * pf buildkit suspend --timeout 1800
 * 
 * # Use with specific kubectl context
 * pf buildkit suspend --context production --timeout 3600
 * ```
 * 
 * @see {@link BuildkitScaleUpCommand} - For resuming BuildKit
 * @see {@link getLastBuildTime} - For checking build activity
 */
export default class BuildkitScaleDownCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'suspend']]

  static override usage = PanfactumCommand.Usage({
    description: 'Scales the BuildKit instances to 0 replicas.',
    category: 'BuildKit',
  })

  timeout = Option.String('--timeout', {
    description: 'If provided, will examine the last build annotation on each BuildKit StatefulSet and will only scale down if the specified number of seconds has elapsed since the last build.'
  })

  kubectlContext = Option.String('--context', {
    description: 'The kubectl context to use for interacting with Kubernetes'
  })

  /**
   * Executes the BuildKit suspension command
   * 
   * @remarks
   * Validates timeout parameters, checks last build timestamps (if timeout specified),
   * and scales down BuildKit StatefulSets to 0 replicas. The command operates across
   * all configured regions and architectures.
   * 
   * @returns Exit code (0 for success, 1 for failure)
   * 
   * @throws {@link PanfactumZodError}
   * Throws when timeout parameter is invalid (not a positive integer)
   * 
   * @throws {@link CLIError}
   * Throws when scaling operations fail or Kubernetes connectivity issues occur
   */
  async execute(): Promise<number> {
    // Validate timeout if provided
    let timeoutSeconds: number | undefined
    if (this.timeout) {
      const timeoutSchema = z.string().regex(/^\d+$/, 'Timeout must be a positive integer').transform(Number);
      const result = timeoutSchema.safeParse(this.timeout);
      if (!result.success) {
        throw new PanfactumZodError('Invalid timeout value', 'timeout', result.error);
      }
      timeoutSeconds = result.data;
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