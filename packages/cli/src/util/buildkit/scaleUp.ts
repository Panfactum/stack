// This file provides utilities for scaling up BuildKit StatefulSets
// It ensures BuildKit pods are available before starting builds

import { z } from 'zod'
import { CLIError, PanfactumZodError } from '@/util/error/error.js'
import { getKubectlContextArgs } from '@/util/kube/getKubectlContextArgs.js'
import { execute } from '@/util/subprocess/execute.js'
import { sleep } from '@/util/util/sleep'
import { type Architecture, BUILDKIT_NAMESPACE, BUILDKIT_STATEFULSET_NAME_PREFIX, architectures } from './constants.js'
import { recordBuildKitBuild } from './recordBuild.js'
import type { PanfactumContext } from '@/util/context/context.js'

/**
 * Zod schema for validating Kubernetes replica counts
 */
const replicaCountSchema = z.string()
  .regex(/^\d+$/, 'Replica count must be a non-negative integer')
  .transform(Number)
  .describe('Kubernetes StatefulSet replica count')

/**
 * Input parameters for scaling up BuildKit StatefulSets
 */
export interface IScaleUpBuildKitInput {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext
  /** Architectures to scale up (defaults to all) */
  architectures?: Architecture[]
  /** Kubernetes context to use */
  kubectlContext?: string
  /** Whether to wait for pods to become ready */
  wait?: boolean
  /** Maximum time to wait for scale-up (default: 600 seconds) */
  timeoutSeconds?: number
}

/**
 * Scales up BuildKit StatefulSets to ensure build capacity is available
 * 
 * @remarks
 * This function manages BuildKit StatefulSet scaling to ensure build
 * infrastructure is ready before attempting builds. It's designed to:
 * 
 * - **Prevent cold starts**: Ensure pods are running before builds begin
 * - **Support auto-scaling**: Work with cluster auto-scaling policies
 * - **Handle multiple architectures**: Scale amd64 and arm64 independently
 * - **Provide reliability**: Wait for pods to be fully ready
 * 
 * The scaling process:
 * 1. Checks current replica count for each architecture
 * 2. Scales from 0 to 1 replica if needed
 * 3. Records a build timestamp to prevent immediate scale-down
 * 4. Optionally waits for pods to become available
 * 
 * Common use cases:
 * - Pre-build preparation in CI/CD pipelines
 * - Ensuring capacity before large build operations
 * - Recovering from scale-to-zero events
 * - Multi-architecture build preparation
 * 
 * @param input - Configuration for the scale-up operation
 * 
 * @example
 * ```typescript
 * // Scale up all architectures and wait
 * await scaleUpBuildKit({
 *   context,
 *   wait: true,
 *   timeoutSeconds: 300
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Scale up only amd64 architecture
 * await scaleUpBuildKit({
 *   context,
 *   architectures: ['amd64'],
 *   kubectlContext: 'production'
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when timeout is exceeded while waiting for pods
 * 
 * @throws {@link PanfactumZodError}
 * Throws when kubectl returns invalid replica counts
 * 
 * @throws {@link CLISubprocessError}
 * Throws when kubectl commands fail
 * 
 * @see {@link recordBuildKitBuild} - For preventing immediate scale-down
 * @see {@link architectures} - Available architecture options
 */
export async function scaleUpBuildKit(input: IScaleUpBuildKitInput): Promise<void> {
  const {
    context,
    architectures: archsToScale = architectures,
    kubectlContext,
    wait = false,
    timeoutSeconds = 600
  } = input;

  // Scale up each architecture in parallel
  await Promise.all(archsToScale.map(arch => scaleUp(arch, context, kubectlContext)))

  // Wait for scale-up if requested
  if (wait) {
    const startTime = Date.now()

    for (const arch of archsToScale) {
      await waitForScaleUp(arch, context, kubectlContext, startTime, timeoutSeconds)
    }
  }
}

/**
 * Scales up a single BuildKit StatefulSet for a specific architecture
 * 
 * @internal
 * @param arch - Target architecture
 * @param context - Panfactum context
 * @param kubectlContext - Optional Kubernetes context
 */
async function scaleUp(arch: Architecture, context: PanfactumContext, kubectlContext?: string): Promise<void> {
  const statefulsetName = `${BUILDKIT_STATEFULSET_NAME_PREFIX}${arch}`
  const contextArgs = getKubectlContextArgs(kubectlContext)

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
    context,
    workingDirectory: process.cwd()
  })

  const parseResult = replicaCountSchema.safeParse(result.stdout.trim())
  if (!parseResult.success) {
    throw new PanfactumZodError(
      `Invalid replica count returned from kubectl for ${statefulsetName}`,
      'kubectl output',
      parseResult.error
    )
  }
  const currentReplicas = parseResult.data

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
      context,
      workingDirectory: process.cwd()
    })
  }

  // Record a "build" to prevent immediate scale-down
  await recordBuildKitBuild({ arch, kubectlContext, context })
}

/**
 * Waits for a BuildKit StatefulSet to have available replicas
 * 
 * @internal
 * @param arch - Target architecture
 * @param context - Panfactum context
 * @param kubectlContext - Optional Kubernetes context
 * @param startTime - Start time for timeout calculation
 * @param timeoutSeconds - Maximum wait time
 */
async function waitForScaleUp(
  arch: Architecture, 
  context: PanfactumContext, 
  kubectlContext: string | undefined,
  startTime: number, 
  timeoutSeconds: number
): Promise<void> {
  const statefulsetName = `${BUILDKIT_STATEFULSET_NAME_PREFIX}${arch}`
  const contextArgs = getKubectlContextArgs(kubectlContext)

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
      context,
      workingDirectory: process.cwd()
    })

    const outputValue = result.stdout.trim() || '0'
    const parseResult = replicaCountSchema.safeParse(outputValue)
    if (!parseResult.success) {
      throw new PanfactumZodError(
        `Invalid available replica count returned from kubectl for ${statefulsetName}`,
        'kubectl output',
        parseResult.error
      )
    }
    const availableReplicas = parseResult.data

    if (availableReplicas >= 1) {
      break
    }

    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
    const remainingSeconds = timeoutSeconds - elapsedSeconds

    if (elapsedSeconds >= timeoutSeconds) {
      throw new CLIError(`Timeout reached while waiting for StatefulSet ${statefulsetName} to scale up.`)
    }

    context.logger.info(`${arch}: Waiting ${remainingSeconds} seconds for at least one BuildKit replica to become available...`)
    
    // Sleep for 10 seconds
    await sleep(10000)
  }
}