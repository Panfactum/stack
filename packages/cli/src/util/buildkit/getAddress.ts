// This file provides utilities for discovering BuildKit pod addresses in Kubernetes
// It selects the least loaded pod for a given architecture for optimal build performance

import { CLIError } from '@/util/error/error'
import { execute } from '@/util/subprocess/execute.js'
import {
  type Architecture,
  BUILDKIT_NAMESPACE,
  BUILDKIT_PORT
} from './constants.js'
import type { PanfactumContext } from '@/util/context/context.js'

/**
 * Input parameters for retrieving BuildKit pod address
 */
interface IGetBuildKitAddressInput {
  /** Target architecture for BuildKit pod selection */
  arch: Architecture
  /** Kubernetes context to use (optional) */
  kubectlContext?: string
  /** Whether to omit the tcp:// protocol prefix from the address */
  omitProtocol?: boolean
  /** Panfactum context for configuration and logging */
  context: PanfactumContext
}

/**
 * Gets the address of the least loaded BuildKit pod for a specific architecture
 * 
 * @remarks
 * This function implements intelligent pod selection for BuildKit builds by:
 * 
 * 1. **Pod Discovery**: Finds all running BuildKit pods matching the architecture
 * 2. **Load Balancing**: Queries CPU metrics for each pod
 * 3. **Smart Selection**: Chooses the pod with lowest CPU usage
 * 4. **Address Resolution**: Converts pod IP to Kubernetes DNS format
 * 
 * The selection algorithm helps:
 * - Distribute builds across available pods
 * - Avoid overloading busy pods
 * - Improve build performance
 * - Utilize cluster resources efficiently
 * 
 * The returned address format is:
 * - With protocol: `tcp://[pod-ip-dns].buildkit.pod.cluster.local:1234`
 * - Without protocol: `[pod-ip-dns].buildkit.pod.cluster.local:1234`
 * 
 * Common use cases:
 * - Docker/container builds via BuildKit
 * - Multi-architecture builds (amd64/arm64)
 * - Build farm load distribution
 * - CI/CD pipeline optimization
 * 
 * @param input - Configuration for pod selection
 * @returns BuildKit pod address in Kubernetes DNS format
 * 
 * @example
 * ```typescript
 * // Get BuildKit address for amd64 architecture
 * const address = await getBuildKitAddress({
 *   context,
 *   arch: 'amd64',
 *   kubectlContext: 'production-cluster'
 * });
 * // Returns: "tcp://10-0-1-15.buildkit.pod.cluster.local:1234"
 * ```
 * 
 * @example
 * ```typescript
 * // Get address without protocol for direct usage
 * const address = await getBuildKitAddress({
 *   context,
 *   arch: 'arm64',
 *   omitProtocol: true
 * });
 * // Returns: "10-0-2-20.buildkit.pod.cluster.local:1234"
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when no running BuildKit pods are found for the architecture
 * 
 * @throws {@link CLIError}
 * Throws when pod IP cannot be retrieved
 * 
 * @throws {@link CLISubprocessError}
 * Throws when kubectl commands fail
 * 
 * @see {@link Architecture} - Supported architectures (amd64, arm64)
 * @see {@link BUILDKIT_NAMESPACE} - Kubernetes namespace for BuildKit
 * @see {@link execute} - For kubectl command execution
 */
export async function getBuildKitAddress(
  input: IGetBuildKitAddressInput
): Promise<string> {
  const { arch, kubectlContext, omitProtocol = false, context } = input;

  const workingDirectory = context.devshellConfig.repo_root

  // Get running pods filtered by architecture
  const contextArgs = kubectlContext ? ['--context', kubectlContext] : []
  const podsResult = await execute({
    context,
    workingDirectory,
    command: [
      'kubectl',
      ...contextArgs,
      'get',
      'pods',
      '-n',
      BUILDKIT_NAMESPACE,
      '-o=jsonpath={range .items[?(@.status.phase=="Running")]}{.metadata.name}{"\\n"}'
    ],
  })

  const pods = podsResult.stdout
    .trim()
    .split('\n')
    .filter(pod => pod.includes(arch))

  if (pods.length === 0) {
    throw new CLIError(`No running BuildKit pods found for architecture ${arch}`)
  }

  // Sort pods by CPU usage (pods without metrics go first as they're likely unused)
  const podMetrics = await Promise.all(
    pods.map(async (pod: string) => {
      try {
        const metricsResult = await execute({
          context,
          workingDirectory,
          command: [
            'kubectl',
            ...contextArgs,
            'get',
            'pods.metrics.k8s.io',
            '-n',
            BUILDKIT_NAMESPACE,
            pod,
            '-o=jsonpath={.containers[*].usage.cpu}'
          ],
        })
        // Parse CPU usage (e.g., "100m" -> 100, "1" -> 1000)
        const cpuUsage = metricsResult.stdout.trim()
        let cpuValue = 0
        if (cpuUsage) {
          if (cpuUsage.endsWith('m')) {
            cpuValue = parseInt(cpuUsage.slice(0, -1))
          } else {
            cpuValue = parseInt(cpuUsage) * 1000
          }
        }
        return { pod, cpuUsage: cpuValue }
      } catch {
        // If metrics not available, assume 0 usage
        return { pod, cpuUsage: 0 }
      }
    })
  )

  // Sort by CPU usage and get the least used pod
  interface IPodMetric {
    pod: string
    cpuUsage: number
  }
  podMetrics.sort((a: IPodMetric, b: IPodMetric) => a.cpuUsage - b.cpuUsage)
  const selectedPod = podMetrics[0]?.pod

  if (!selectedPod) {
    throw new CLIError('No pod available')
  }

  // Get pod IP
  const ipResult = await execute({
    context,
    workingDirectory,
    command: [
      'kubectl',
      ...contextArgs,
      'get',
      'pod',
      selectedPod,
      '-n',
      BUILDKIT_NAMESPACE,
      '-o=jsonpath={.status.podIP}'
    ],
  })

  const podIP = ipResult.stdout.trim()
  if (!podIP) {
    throw new CLIError(`Could not get IP for pod ${selectedPod}`)
  }

  // Convert IP to Kubernetes DNS format (dots to dashes)
  const dnsIP = podIP.replace(/\./g, '-')
  const address = `${dnsIP}.${BUILDKIT_NAMESPACE}.pod.cluster.local:${BUILDKIT_PORT}`

  return omitProtocol ? address : `tcp://${address}`
}