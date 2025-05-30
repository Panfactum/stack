import { Option } from 'clipanion'
import { BUILDKIT_NAMESPACE } from '@/util/buildkit/constants.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { execute } from '@/util/subprocess/execute.js'

export default class BuildkitClearCacheCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'clear-cache']]

  static override usage = PanfactumCommand.Usage({
    description: 'Deletes the idle cache from all BuildKit instances.'
  })

  kubectlContext = Option.String('--context', {
    description: 'The kubectl context to use for interacting with Kubernetes'
  })

  async execute(): Promise<number> {
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

    // Delete unused PVCs
    await this.deleteUnusedPVCs()

    // Prune cache in running pods
    await this.prunePodCaches()

    return 0
  }

  private async deleteUnusedPVCs(): Promise<void> {
    const contextArgs = this.kubectlContext ? ['--context', this.kubectlContext] : []
    
    // Get all PVCs
    const pvcsResult = await execute({
      command: [
        'kubectl',
        ...contextArgs,
        'get',
        'pvc',
        '--namespace',
        BUILDKIT_NAMESPACE,
        '--output',
        'jsonpath={.items[*].metadata.name}'
      ],
      context: this.context,
      workingDirectory: process.cwd()
    })

    const pvcs = pvcsResult.stdout.trim().split(/\s+/).filter(Boolean)

    // Get pods that use PVCs
    const podsResult = await execute({
      command: [
        'kubectl',
        ...contextArgs,
        'get',
        'pods',
        '--namespace',
        BUILDKIT_NAMESPACE,
        '-o',
        'json'
      ],
      context: this.context,
      workingDirectory: process.cwd()
    })

    interface Pod {
      spec: {
        volumes?: Array<{
          persistentVolumeClaim?: {
            claimName: string
          }
        }>
      }
    }
    
    interface PodsData {
      items: Pod[]
    }
    
    const podsData = JSON.parse(podsResult.stdout) as PodsData

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
        await execute({
          command: [
            'kubectl',
            ...contextArgs,
            'delete',
            'pvc',
            pvc,
            '--namespace',
            BUILDKIT_NAMESPACE,
            '--wait=false'
          ],
          context: this.context,
          workingDirectory: process.cwd()
        })
      } else {
        this.context.logger.info(`PVC in use: ${pvc}`)
      }
    }
  }

  private async prunePodCaches(): Promise<void> {
    const contextArgs = this.kubectlContext ? ['--context', this.kubectlContext] : []
    
    // Get running pods
    const podsResult = await execute({
      command: [
        'kubectl',
        ...contextArgs,
        'get',
        'pods',
        '-n',
        BUILDKIT_NAMESPACE,
        '-o',
        'jsonpath={range .items[*]}{.metadata.name} {.status.phase}{"\\n"}{end}'
      ],
      context: this.context,
      workingDirectory: process.cwd()
    })

    const pods = podsResult.stdout.trim().split('\n').filter(Boolean)

    for (const podLine of pods) {
      const [podName, status] = podLine.split(' ')
      
      if (status === 'Running' && podName && podName.includes('buildkit')) {
        this.context.logger.info(`Pruning cache in running BuildKit pod: ${podName}`)
        
        try {
          await execute({
            command: [
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
            ],
            context: this.context,
            workingDirectory: process.cwd()
          })
        } catch (error) {
          this.context.logger.error(`Failed to prune cache in ${podName}: ${String(error)}`)
        }
      }
    }
  }
}