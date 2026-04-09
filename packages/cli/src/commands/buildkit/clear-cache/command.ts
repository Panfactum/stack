// This file defines the clear-cache command for BuildKit cache management
// It removes unused persistent volumes and prunes build caches from running pods

import { Option } from 'clipanion'
import { z } from 'zod'
import { BUILDKIT_NAMESPACE } from '@/util/buildkit/constants.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { getAllRegions } from '@/util/config/getAllRegions.js'
import { CLISubprocessError } from '@/util/error/error'
import { parseJson } from '@/util/json/parseJson'
import { getKubectlContextArgs } from '@/util/kube/getKubectlContextArgs.js'

/**
 * CLI command for clearing BuildKit caches and unused storage
 * 
 * @remarks
 * This command performs comprehensive BuildKit cache cleanup to reclaim
 * storage space and resolve build issues. It operates in two phases:
 * 
 * 1. **Persistent Volume Cleanup**: Removes PVCs not attached to any pod
 * 2. **Pod Cache Pruning**: Clears build caches from all running BuildKit pods
 * 
 * Cache cleanup is necessary for:
 * - Freeing disk space consumed by old build layers
 * - Resolving corrupted cache issues
 * - Removing sensitive data from build caches
 * - Periodic maintenance of build infrastructure
 * 
 * The command safely handles:
 * - Detection of PVCs in use vs orphaned
 * - Only pruning caches in running pods
 * - Graceful error handling for pod operations
 * - Multi-region BuildKit deployments
 * 
 * @example
 * ```bash
 * # Clear caches in current kubectl context
 * pf buildkit clear-cache
 * 
 * # Clear caches in specific cluster
 * pf buildkit clear-cache --context production-cluster
 * 
 * # Typical workflow after cache issues
 * pf buildkit clear-cache
 * pf buildkit build --dockerfile ./Dockerfile --tag myapp:latest
 * ```
 * 
 * @see {@link BUILDKIT_NAMESPACE} - Kubernetes namespace for BuildKit
 * @see {@link execute} - For running kubectl commands
 */
export default class BuildkitClearCacheCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'clear-cache']]

  static override usage = PanfactumCommand.Usage({
    description: 'Clears BuildKit cache by pruning all caches in running pods and deleting unused persistent volumes.',
    category: 'BuildKit',
  })

  /** Kubernetes context for cluster selection */
  kubectlContext = Option.String('--context', {
    description: 'The kubectl context to use for interacting with Kubernetes'
  })

  /**
   * Executes the cache clearing operation
   * 
   * @remarks
   * Performs a two-phase cleanup:
   * 1. Deletes PVCs not attached to any pods
   * 2. Prunes caches in all running BuildKit pods
   * 
   * @returns Exit code (0 for success, 1 for errors)
   * 
   * @throws {@link CLISubprocessError}
   * Throws when kubectl commands fail
   */
  async execute(): Promise<number> {
    // Validate context if provided
    if (this.kubectlContext) {
      const allRegions = await getAllRegions(this.context)
      const matchingRegion = allRegions.find(region => region.clusterContextName === this.kubectlContext)

      if (!matchingRegion) {
        this.context.logger.error(`'${this.kubectlContext}' not found in any configured region.`)
        return 1
      }
    }

    // Delete unused PVCs
    await this.deleteUnusedPVCs()

    // Prune cache in running pods
    await this.prunePodCaches()

    return 0
  }

  /**
   * Deletes PersistentVolumeClaims not attached to any pods
   * 
   * @remarks
   * Identifies orphaned PVCs by comparing all PVCs in the namespace
   * against volumes mounted in pods. Safely deletes only unused PVCs.
   * 
   * @private
   */
  private async deleteUnusedPVCs(): Promise<void> {
    const contextArgs = getKubectlContextArgs(this.kubectlContext)

    // Get all PVCs
    const getPVCsCommand = [
      'kubectl',
      ...contextArgs,
      'get',
      'pvc',
      '--namespace',
      BUILDKIT_NAMESPACE,
      '--output',
      'jsonpath={.items[*].metadata.name}'
    ]
    const pvcsResult = await this.context.subprocessManager.execute({
      command: getPVCsCommand,
      workingDirectory: process.cwd()
    }).exited

    if (pvcsResult.exitCode !== 0) {
      throw new CLISubprocessError(
        `Failed to list PVCs in ${BUILDKIT_NAMESPACE} namespace`,
        {
          command: getPVCsCommand.join(' '),
          subprocessLogs: pvcsResult.output,
          workingDirectory: process.cwd(),
        }
      )
    }

    /*
    1. kubectl output format: The jsonpath={.items[*].metadata.name} returns space-separated PVC names
    2. Split creates empty strings: split(/\s+/) can create empty strings if there are extra whitespaces
    3. filter(x => x.trim()) removes empty or whitespace-only entries: Ensures we only get actual PVC names

    Without filtering, you could get an array like ["cache-pvc-1", "", "cache-pvc-2", ""] which would cause issues when trying to process each PVC
    name later in the code.
     */
    const pvcs = pvcsResult.stdout.trim().split(/\s+/).filter(x => x.trim())

    // Get pods that use PVCs
    const getPodsCommand = [
      'kubectl',
      ...contextArgs,
      'get',
      'pods',
      '--namespace',
      BUILDKIT_NAMESPACE,
      '-o',
      'json'
    ]
    const podsResult = await this.context.subprocessManager.execute({
      command: getPodsCommand,
      workingDirectory: process.cwd()
    }).exited

    if (podsResult.exitCode !== 0) {
      throw new CLISubprocessError(
        `Failed to list pods in ${BUILDKIT_NAMESPACE} namespace`,
        {
          command: getPodsCommand.join(' '),
          subprocessLogs: podsResult.output,
          workingDirectory: process.cwd(),
        }
      )
    }

    const podSchema = z.object({
      spec: z.object({
        volumes: z.array(z.object({
          persistentVolumeClaim: z.object({
            /** Name of the PVC referenced by this volume */
            claimName: z.string().describe('PVC name')
          }).optional().describe('PVC volume source')
        }).describe('Pod volume')).optional().describe('Pod volumes')
      }).describe('Pod specification')
    }).describe('Kubernetes pod structure')
    
    const podsDataSchema = z.object({
      items: z.array(podSchema).describe('List of pods')
    }).describe('Kubernetes pod list response')
    
    const podsData = parseJson(podsDataSchema, podsResult.stdout)

    // Check each PVC
    for (const pvc of pvcs) {
      // Check if PVC is used by any pod
      const isUsed = podsData.items.some((pod) => 
        pod.spec.volumes?.some((volume) => 
          volume.persistentVolumeClaim?.claimName === pvc
        )
      )

      if (!isUsed) {
        this.context.logger.info(`Deleting unused PVC: ${pvc}`)
        const deletePVCCommand = [
          'kubectl',
          ...contextArgs,
          'delete',
          'pvc',
          pvc,
          '--namespace',
          BUILDKIT_NAMESPACE,
          '--wait=false'
        ]
        const deletePVCResult = await this.context.subprocessManager.execute({
          command: deletePVCCommand,
          workingDirectory: process.cwd()
        }).exited

        if (deletePVCResult.exitCode !== 0) {
          throw new CLISubprocessError(
            `Failed to delete PVC ${pvc}`,
            {
              command: deletePVCCommand.join(' '),
              subprocessLogs: deletePVCResult.output,
              workingDirectory: process.cwd(),
            }
          )
        }
      } else {
        this.context.logger.info(`PVC in use: ${pvc}`)
      }
    }
  }

  /**
   * Prunes build caches from all running BuildKit pods
   * 
   * @remarks
   * Executes buildctl prune command in each running BuildKit pod
   * to clear all cached layers and intermediate build artifacts.
   * 
   * @private
   */
  private async prunePodCaches(): Promise<void> {
    const contextArgs = getKubectlContextArgs(this.kubectlContext)

    // Get running pods
    const getPodsCommand = [
      'kubectl',
      ...contextArgs,
      'get',
      'pods',
      '-n',
      BUILDKIT_NAMESPACE,
      '-o',
      'jsonpath={range .items[*]}{.metadata.name} {.status.phase}{"\\n"}{end}'
    ]
    const podsResult = await this.context.subprocessManager.execute({
      command: getPodsCommand,
      workingDirectory: process.cwd()
    }).exited

    if (podsResult.exitCode !== 0) {
      throw new CLISubprocessError(
        `Failed to list pods in ${BUILDKIT_NAMESPACE} namespace`,
        {
          command: getPodsCommand.join(' '),
          subprocessLogs: podsResult.output,
          workingDirectory: process.cwd(),
        }
      )
    }

    const pods = podsResult.stdout.trim().split('\n').filter(x => x.trim())

    for (const podLine of pods) {
      const [podName, status] = podLine.split(' ')
      
      if (status === 'Running' && podName && podName.includes('buildkit')) {
        this.context.logger.info(`Pruning cache in running BuildKit pod: ${podName}`)

        const pruneCommand = [
          'kubectl',
          ...contextArgs,
          'exec',
          podName,
          '-c',
          'buildkitd',
          '-n',
          BUILDKIT_NAMESPACE,
          '--',
          'buildctl',
          'prune',
          '--all'
        ]
        const pruneResult = await this.context.subprocessManager.execute({
          command: pruneCommand,
          workingDirectory: process.cwd(),
        }).exited
        if (pruneResult.exitCode !== 0) {
          throw new CLISubprocessError(`Failed to prune cache in pod ${podName}`, {
            command: pruneCommand.join(' '),
            subprocessLogs: pruneResult.output,
            workingDirectory: process.cwd(),
          })
        }
      }
    }
  }
}