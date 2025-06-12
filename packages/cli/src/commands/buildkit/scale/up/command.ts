import { Option } from 'clipanion'
import { z } from 'zod'
import { type Architecture, BUILDKIT_NAMESPACE, BUILDKIT_STATEFULSET_NAME_PREFIX, architectures } from '@/util/buildkit/constants.js'
import { recordBuildKitBuild } from '@/util/buildkit/recordBuild.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { CLUSTERS_FILE_SCHEMA } from '@/util/devshell/updateKubeConfig.js'
import { CLIError } from '@/util/error/error'
import { execute } from '@/util/subprocess/execute.js'
import { validateEnum } from '@/util/types/typeGuards.js'
import { readYAMLFile } from '@/util/yaml/readYAMLFile.js'

// Zod schemas for kubectl output validation
const replicaCountSchema = z.string().regex(/^\d+$/, 'Replica count must be a non-negative integer').transform(Number)
const timeoutSchema = z.string().regex(/^\d+$/, 'Timeout must be a positive integer').transform(Number)

export default class BuildkitScaleUpCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'scale', 'up']]

  static override usage = PanfactumCommand.Usage({
    description: 'Scales up BuildKit from 0. Helper to be used prior to a build.'
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
    let validatedOnly: Architecture | undefined
    if (this.only) {
      validatedOnly = validateEnum(this.only, architectures)
    }

    // Validate context if provided
    if (this.kubectlContext) {
      const clustersData = await readYAMLFile({
        context: this.context,
        filePath: `${this.context.repoVariables.kube_dir}/clusters.yaml`,
        validationSchema: CLUSTERS_FILE_SCHEMA,
        throwOnMissing: false,
        throwOnEmpty: false
      })

      if (!clustersData || !clustersData[this.kubectlContext]) {
        this.context.logger.error(`'${this.kubectlContext}' not found in clusters.yaml.`)
        return 1
      }
    }

    const archsToScale = validatedOnly ? [validatedOnly] : architectures

    // Scale up each architecture in parallel
    await Promise.all(archsToScale.map(arch => this.scaleUp(arch)))

    // Wait for scale-up if requested
    if (this.wait) {
      const timeoutSeconds = timeoutSchema.parse(this.timeout)
      
      const startTime = Date.now()

      for (const arch of archsToScale) {
        await this.waitForScaleUp(arch, startTime, timeoutSeconds)
      }
    }

    return 0
  }

  private async scaleUp(arch: Architecture): Promise<void> {
    const statefulsetName = `${BUILDKIT_STATEFULSET_NAME_PREFIX}${arch}`
    const contextArgs = this.kubectlContext ? ['--context', this.kubectlContext] : []

    // Get current replicas
    const result = await execute({
      command: [
        'kubectl',
        ...contextArgs,
        'get',
        'statefulset',
        statefulsetName,
        '--namespace',
        BUILDKIT_NAMESPACE,
        '-o=jsonpath={.spec.replicas}'
      ],
      context: this.context,
      workingDirectory: process.cwd()
    })

    const currentReplicas = replicaCountSchema.parse(result.stdout.trim())

    if (currentReplicas === 0) {
      // Scale up
      await execute({
        command: [
          'kubectl',
          ...contextArgs,
          'scale',
          'statefulset',
          statefulsetName,
          '--namespace',
          BUILDKIT_NAMESPACE,
          '--replicas=1'
        ],
        context: this.context,
        workingDirectory: process.cwd()
      })
    }

    // Record a "build" to prevent immediate scale-down
    await recordBuildKitBuild({ arch, kubectlContext: this.kubectlContext, context: this.context })
  }

  private async waitForScaleUp(arch: Architecture, startTime: number, timeoutSeconds: number): Promise<void> {
    const statefulsetName = `${BUILDKIT_STATEFULSET_NAME_PREFIX}${arch}`
    const contextArgs = this.kubectlContext ? ['--context', this.kubectlContext] : []

    while (true) {
      const result = await execute({
        command: [
          'kubectl',
          ...contextArgs,
          'get',
          'statefulset',
          statefulsetName,
          '--namespace',
          BUILDKIT_NAMESPACE,
          '-o=jsonpath={.status.availableReplicas}'
        ],
        context: this.context,
        workingDirectory: process.cwd()
      })

      const availableReplicas = replicaCountSchema.parse(result.stdout.trim() || '0')

      if (availableReplicas >= 1) {
        break
      }

      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
      const remainingSeconds = timeoutSeconds - elapsedSeconds

      if (elapsedSeconds >= timeoutSeconds) {
        throw new CLIError(`Timeout reached while waiting for StatefulSet ${statefulsetName} to scale up.`)
      }

      this.context.logger.info(`${arch}: Waiting ${remainingSeconds} seconds for at least one BuildKit replica to become available...`)
      
      // Sleep for 10 seconds
      await new Promise(resolve => globalThis.setTimeout(resolve, 10000))
    }
  }
}