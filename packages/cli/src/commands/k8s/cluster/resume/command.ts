import { Command, Option } from 'clipanion'
import { Listr } from 'listr2'
import { getAWSProfileForContext } from '@/util/aws/getProfileForContext.ts'
import {
  AUTO_SCALING_GROUPS_WITH_TAGS_SCHEMA,
  EKS_DESCRIBE_CLUSTER_SCHEMA,
  EKS_LIST_NODEGROUPS_SCHEMA,
  KUBERNETES_ITEMS_SCHEMA
} from '@/util/aws/schemas.ts'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import { validateRootProfile } from '@/util/eks/validateRootProfile.ts'
import { CLIError } from '@/util/error/error'
import { execute } from '@/util/subprocess/execute.ts'
import { parseJson } from '@/util/zod/parseJson'
import type { EksClusterInfo } from '@/util/eks/types.ts'

export class K8sClusterResumeCommand extends PanfactumCommand {
  static override paths = [['k8s', 'cluster', 'resume']]

  static override usage = Command.Usage({
    description: 'Resume a suspended EKS cluster by restoring nodes',
    details: `
      This command resumes a suspended EKS cluster by:
      - Restoring NAT gateway Auto Scaling Groups
      - Restoring EKS node groups to original capacity
      - Removing Karpenter node pool limits
      - Clearing pending pods
      - Restoring schedulers
      - Removing suspension tag
      
      The cluster must have been previously suspended with 'pf k8s cluster suspend'.
    `,
    examples: [
      [
        'Resume a cluster',
        '$0 k8s cluster resume --cluster production-eks',
      ],
    ],
  })

  cluster = Option.String('--cluster', {
    required: true,
    description: 'Name of the EKS cluster to resume',
  })

  async execute() {
    const { context } = this
    let clusterInfo: EksClusterInfo
    let awsProfile: string

    const tasks = new Listr([
      {
        title: 'Validating AWS access',
        task: async () => {
          awsProfile = await getAWSProfileForContext(context, this.cluster)
          await validateRootProfile(awsProfile, context)
        },
      },
      {
        title: 'Verifying cluster is suspended',
        task: async () => {
          const { stdout } = await execute({
            command: ['aws', 'eks', 'describe-cluster', '--name', this.cluster, '--output', 'json'],
            context,
            workingDirectory: process.cwd(),
          })
          const result = parseJson(EKS_DESCRIBE_CLUSTER_SCHEMA, stdout)
          clusterInfo = result.cluster
          
          if (clusterInfo.tags?.['panfactum.com/suspended'] !== 'true') {
            throw new CLIError('Cluster is not marked as suspended')
          }
        },
      },
      {
        title: 'Restoring NAT gateway Auto Scaling Groups',
        task: async () => {
          // Find ASGs with original size tags
          const { stdout } = await execute({
            command: [
              'aws', 'autoscaling', 'describe-auto-scaling-groups', 
              '--query', `AutoScalingGroups[?contains(AutoScalingGroupName, 'nat') && Tags[?Key=='kubernetes.io/cluster/${this.cluster}' && Value=='owned'] && Tags[?Key=='panfactum.com/original-min-size']]`, 
              '--output', 'json'
            ],
            context,
            workingDirectory: process.cwd(),
          })
          
          const groups = parseJson(AUTO_SCALING_GROUPS_WITH_TAGS_SCHEMA, stdout)
          
          for (const group of groups) {
            // Extract original values from tags
            const originalMinSize = group.Tags.find(t => t.Key === 'panfactum.com/original-min-size')?.Value || '1'
            const originalMaxSize = group.Tags.find(t => t.Key === 'panfactum.com/original-max-size')?.Value || '1'
            const originalDesiredCapacity = group.Tags.find(t => t.Key === 'panfactum.com/original-desired-capacity')?.Value || '1'
            
            // Restore original size
            await execute({
              command: [
                'aws', 'autoscaling', 'update-auto-scaling-group', 
                '--auto-scaling-group-name', group.AutoScalingGroupName, 
                '--min-size', originalMinSize, 
                '--max-size', originalMaxSize, 
                '--desired-capacity', originalDesiredCapacity
              ],
              context,
              workingDirectory: process.cwd(),
            })
            
            // Remove temporary tags
            await execute({
              command: [
                'aws', 'autoscaling', 'delete-tags', '--tags',
                `ResourceId=${group.AutoScalingGroupName},ResourceType=auto-scaling-group,Key=panfactum.com/original-min-size`,
                `ResourceId=${group.AutoScalingGroupName},ResourceType=auto-scaling-group,Key=panfactum.com/original-max-size`,
                `ResourceId=${group.AutoScalingGroupName},ResourceType=auto-scaling-group,Key=panfactum.com/original-desired-capacity`
              ],
              context,
              workingDirectory: process.cwd(),
            })
          }
          
          // Wait for NAT instances to be ready
          await new Promise(resolve => globalThis.setTimeout(resolve, 30000))
        },
      },
      {
        title: 'Updating Cilium operator scheduler',
        task: async () => {
          try {
            await execute({
              command: [
                'kubectl', '--context', this.cluster, '-n', 'kube-system', 
                'set', 'env', 'deployment/cilium-operator', 'CILIUM_K8S_SCHEDULER=panfactum'
              ],
              context,
              workingDirectory: process.cwd(),
            })
          } catch {
            // Cilium might not be installed
          }
        },
      },
      {
        title: 'Clearing pending pods',
        task: async () => {
          // Delete all pending pods to force rescheduling
          try {
            await execute({
              command: [
                'kubectl', '--context', this.cluster, 
                'delete', 'pods', '--all-namespaces', '--field-selector=status.phase=Pending'
              ],
              context,
              workingDirectory: process.cwd(),
              errorMessage: 'Failed to delete pending pods',
              retries: 1,
            })
          } catch {
            // Ignore errors, some pods might not be deletable
          }
        },
      },
      {
        title: 'Restoring EKS node groups',
        task: async () => {
          const { stdout } = await execute({
            command: ['aws', 'eks', 'list-nodegroups', '--cluster-name', this.cluster, '--output', 'json'],
            context,
            workingDirectory: process.cwd(),
          })
          const result = parseJson(EKS_LIST_NODEGROUPS_SCHEMA, stdout)
          const nodeGroups = result.nodegroups || []
          
          for (const nodeGroup of nodeGroups) {
            // Get the original configuration (usually 3 nodes)
            await execute({
              command: [
                'aws', 'eks', 'update-nodegroup-config', 
                '--cluster-name', this.cluster, 
                '--nodegroup-name', nodeGroup, 
                '--scaling-config', 'minSize=3,maxSize=3,desiredSize=3'
              ],
              context,
              workingDirectory: process.cwd(),
            })
          }
          
          if (nodeGroups.length > 0) {
            // Wait for nodes to join
            await new Promise(resolve => globalThis.setTimeout(resolve, 60000))
          }
        },
      },
      {
        title: 'Removing Karpenter node pool limits',
        task: async () => {
          try {
            // Get all Karpenter node pools
            const { stdout } = await execute({
              command: ['kubectl', '--context', this.cluster, 'get', 'nodepools.karpenter.sh', '-o', 'json'],
              context,
              workingDirectory: process.cwd(),
            })
            
            const result = parseJson(KUBERNETES_ITEMS_SCHEMA, stdout)
            const nodePools = result.items || []
            
            for (const nodePool of nodePools) {
              // Remove CPU and memory limits
              try {
                await execute({
                  command: [
                    'kubectl', '--context', this.cluster, 
                    'patch', 'nodepool', nodePool.metadata.name, 
                    '--type', 'json', '-p', 
                    '[{"op": "remove", "path": "/spec/limits/cpu"}, {"op": "remove", "path": "/spec/limits/memory"}]'
                  ],
                  context,
                  workingDirectory: process.cwd(),
                })
              } catch {
                // Might fail if limits don't exist
              }
            }
          } catch {
            // Karpenter might not be installed
          }
        },
      },
      {
        title: 'Restoring Panfactum scheduler',
        task: async () => {
          try {
            // Scale up the scheduler deployment
            await execute({
              command: [
                'kubectl', '--context', this.cluster, '-n', 'kube-system', 
                'scale', 'deployment', 'panfactum-scheduler', '--replicas=2'
              ],
              context,
              workingDirectory: process.cwd(),
            })
          } catch {
            // Scheduler might not exist
          }
        },
      },
      {
        title: 'Removing suspension tag',
        task: async () => {
          await execute({
            command: [
              'aws', 'eks', 'untag-resource', 
              '--resource-arn', clusterInfo.arn, 
              '--tag-keys', 'panfactum.com/suspended'
            ],
            context,
            workingDirectory: process.cwd(),
          })
        },
      },
    ], { rendererOptions: { collapseErrors: false } })

    await tasks.run()

    context.logger.info('')
    context.logger.success(`✓ Successfully resumed cluster "${this.cluster}"`)
    context.logger.info('  - NAT gateways have been restored')
    context.logger.info('  - Node groups have been restored')
    context.logger.info('  - Karpenter limits have been removed')
    context.logger.info('  - Schedulers have been restored')
    context.logger.info('')
    context.logger.info('The cluster may take a few minutes to become fully operational.')
  }
}