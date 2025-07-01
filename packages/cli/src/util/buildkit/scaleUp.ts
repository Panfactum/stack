import { z } from 'zod'
import { CLIError, PanfactumZodError } from '@/util/error/error.js'
import { getKubectlContextArgs } from '@/util/kube/getKubectlContextArgs.js'
import { execute } from '@/util/subprocess/execute.js'
import { type Architecture, BUILDKIT_NAMESPACE, BUILDKIT_STATEFULSET_NAME_PREFIX, architectures } from './constants.js'
import { recordBuildKitBuild } from './recordBuild.js'
import type { PanfactumContext } from '@/util/context/context.js'

// Zod schemas for kubectl output validation
const replicaCountSchema = z.string().regex(/^\d+$/, 'Replica count must be a non-negative integer').transform(Number)

export interface ScaleUpOptions {
  context: PanfactumContext
  architectures?: Architecture[]
  kubectlContext?: string
  wait?: boolean
  timeoutSeconds?: number
}

export async function scaleUpBuildKit(options: ScaleUpOptions): Promise<void> {
  const {
    context,
    architectures: archsToScale = architectures,
    kubectlContext,
    wait = false,
    timeoutSeconds = 600
  } = options

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
    await Bun.sleep(10000)
  }
}