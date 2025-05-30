import {
  type Architecture,
  BUILDKIT_NAMESPACE,
  BUILDKIT_PORT
} from './constants.js'
import { execute } from '../subprocess/execute.js'
import type { PanfactumContext } from '@/util/context/context.js'

interface GetAddressOptions {
  arch: Architecture
  kubectlContext?: string
  omitProtocol?: boolean
  context: PanfactumContext
}

export async function getBuildKitAddress(
  options: GetAddressOptions
): Promise<string> {
  const { arch, kubectlContext, omitProtocol = false, context } = options

  const workingDirectory = context.repoVariables.repo_root

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
    throw new Error(`No running BuildKit pods found for architecture ${arch}`)
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
  interface PodMetric {
    pod: string
    cpuUsage: number
  }
  podMetrics.sort((a: PodMetric, b: PodMetric) => a.cpuUsage - b.cpuUsage)
  const selectedPod = podMetrics[0]?.pod
  
  if (!selectedPod) {
    throw new Error('No pod available')
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
    throw new Error(`Could not get IP for pod ${selectedPod}`)
  }

  // Convert IP to Kubernetes DNS format (dots to dashes)
  const dnsIP = podIP.replace(/\./g, '-')
  const address = `${dnsIP}.${BUILDKIT_NAMESPACE}.pod.cluster.local:${BUILDKIT_PORT}`

  return omitProtocol ? address : `tcp://${address}`
}