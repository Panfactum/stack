import { Option } from 'clipanion'
import { z } from 'zod'
import { type Architecture, architectureSchema } from '@/util/buildkit/constants.js'
import { scaleUpBuildKit } from '@/util/buildkit/scaleUp.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { PanfactumZodError } from '@/util/error/error.js'

// Zod schemas for input validation
const timeoutSchema = z.string().regex(/^\d+$/, 'Timeout must be a positive integer').transform(Number)

/**
 * Command for scaling up BuildKit instances from zero replicas
 * 
 * @remarks
 * This command resumes BuildKit services by scaling their StatefulSets from
 * 0 to their configured replica counts. It's designed to be used before
 * starting builds to ensure BuildKit pods are available and ready.
 * 
 * Key features:
 * - Scales up all architectures or specific ones
 * - Optional wait for readiness with configurable timeout
 * - Graceful handling of already-running instances
 * - Multi-architecture BuildKit support (AMD64/ARM64)
 * 
 * The command is essential for:
 * - Resuming BuildKit after suspension for cost savings
 * - Preparing build infrastructure before CI/CD pipelines
 * - Ensuring build capacity is available when needed
 * - Managing BuildKit lifecycle in development environments
 * 
 * @example
 * ```bash
 * # Scale up all BuildKit architectures
 * pf buildkit scale up
 * 
 * # Scale up only AMD64 BuildKit and wait for readiness
 * pf buildkit scale up --only amd64 --wait
 * 
 * # Scale up with custom timeout
 * pf buildkit scale up --wait --timeout 300
 * 
 * # Use with specific kubectl context
 * pf buildkit scale up --context staging --wait
 * ```
 * 
 * @see {@link scaleUpBuildKit} - Core scaling logic
 * @see {@link BuildkitScaleDownCommand} - For suspending BuildKit
 */
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

  /**
   * Executes the BuildKit scale-up command
   * 
   * @remarks
   * Validates input parameters, determines target architectures, and scales
   * up the appropriate BuildKit StatefulSets. Optionally waits for pods to
   * become ready if the --wait flag is specified.
   * 
   * @returns Exit code (0 for success, 1 for failure)
   * 
   * @throws {@link PanfactumZodError}
   * Throws when architecture or timeout parameters are invalid
   * 
   * @throws {@link CLIError}
   * Throws when scaling operations fail or timeout during readiness wait
   */
  async execute(): Promise<number> {
    // Validate architecture if provided and get properly typed value
    let architectures: Architecture[] | undefined
    if (this.only) {
      const result = architectureSchema.safeParse(this.only)
      if (!result.success) {
        throw new PanfactumZodError('Invalid architecture value', 'architecture', result.error);
      }
      architectures = [result.data]
    }

    const timeoutResult = timeoutSchema.safeParse(this.timeout)
    if (!timeoutResult.success) {
      throw new PanfactumZodError('Invalid timeout value', 'timeout', timeoutResult.error);
    }
    const timeoutSeconds = timeoutResult.data

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