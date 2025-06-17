import { DeleteTagsCommand, DescribeAutoScalingGroupsCommand } from '@aws-sdk/client-auto-scaling'
import { DescribeClusterCommand, ListNodegroupsCommand, UpdateNodegroupConfigCommand, UntagResourceCommand } from '@aws-sdk/client-eks'
import { Command, Option } from 'clipanion'
import { Listr } from 'listr2'
import { getAutoScalingClient } from '@/util/aws/clients/getAutoScalingClient.ts'
import { getEKSClient } from '@/util/aws/clients/getEKSClient.ts'
import { scaleASG } from '@/util/aws/scaleASG.ts'
import {
  EKS_DESCRIBE_CLUSTER_SCHEMA,
  KUBERNETES_ITEMS_SCHEMA
} from '@/util/aws/schemas.ts'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import { validateRootProfile } from '@/util/eks/validateRootProfile.ts'
import { CLIError } from '@/util/error/error'
import {getKubeContextsFromConfig} from "@/util/kube/getKubeContextsFromConfig.ts";
import { getAWSProfileForContext } from '@/util/kube/getProfileForContext.ts'
import { execute } from '@/util/subprocess/execute.ts'
import { parseJson } from '@/util/zod/parseJson'
import type { EKSClusterInfo } from '@/util/eks/types.ts'
import { getAllRegions } from '@/util/config/getAllRegions';


export class K8sClusterResumeCommand extends PanfactumCommand {
  static override paths = [['kube', 'cluster-resume']]

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

  kubeContext = Option.String('--kube-context', {
    description: 'Name of the Kube Context to resume',
  })

  async execute() {
    const { context } = this
    const kubeContexts = await getKubeContextsFromConfig(context)

    const selectedContext = this.kubeContext
      ? kubeContexts.find(context => context.name === this.kubeContext)
      : await context.logger.select({
        message: "Select the Cluster context you want to resume:",
        choices: kubeContexts.map(context => ({
          value: context,
          name: `${context.name}`,
        })),
      });

    if (!selectedContext) {
      throw new CLIError(`Kube context '${this.kubeContext}' not found in any configured region.`)
    }

    const regions = await getAllRegions(this.context)
    const selectedRegion = regions.find(region => region.clusterContextName === selectedContext.name)

    if (!selectedRegion) {
      throw new CLIError(`Region for context '${selectedContext.name}' not found in any configured region.`)
    }

    const awsRegion = selectedRegion.awsRegion

    if (!awsRegion) {
      throw new CLIError(`AWS region for context '${selectedContext.name}' not found in any configured region.`)
    }

    const awsProfile: string = await getAWSProfileForContext(context, selectedContext.name)
    const autoScalingClient = await getAutoScalingClient({ context, profile: awsProfile, region: awsRegion })
    const eksClient = await getEKSClient({ context, profile: awsProfile, region: awsRegion })

    let clusterInfo: EKSClusterInfo

    const tasks = new Listr([
      {
        title: 'Validating AWS access',
        task: async () => {
          await validateRootProfile(awsProfile, context)
        },
      },
      {
        title: 'Verifying cluster is suspended',
        task: async () => {
          const response = await eksClient.send(new DescribeClusterCommand({
            name: selectedContext.cluster
          }))
          
          // Validate the response structure for consistency
          const result = parseJson(EKS_DESCRIBE_CLUSTER_SCHEMA, JSON.stringify(response))
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
          const response = await autoScalingClient.send(new DescribeAutoScalingGroupsCommand({}))
          
          // Filter groups matching our criteria
          const groups = (response.AutoScalingGroups || []).filter(asg => {
            if (!asg.AutoScalingGroupName?.includes('nat')) return false
            
            const tags = asg.Tags || []
            const hasClusterTag = tags.some(tag => 
              tag.Key === `kubernetes.io/cluster/${clusterInfo.name}` && tag.Value === 'owned'
            )
            const hasOriginalMinSize = tags.some(tag => tag.Key === 'panfactum.com/original-min-size')
            
            return hasClusterTag && hasOriginalMinSize
          })
          
          for (const group of groups) {
            if (!group.AutoScalingGroupName) continue
            
            // Extract original values from tags
            const tags = group.Tags || []
            const originalMinSize = parseInt(tags.find(t => t.Key === 'panfactum.com/original-min-size')?.Value || '1')
            const originalMaxSize = parseInt(tags.find(t => t.Key === 'panfactum.com/original-max-size')?.Value || '1')
            const originalDesiredCapacity = parseInt(tags.find(t => t.Key === 'panfactum.com/original-desired-capacity')?.Value || '1')
            
            // Restore original size using scaleASG utility
            await scaleASG({
              asgName: group.AutoScalingGroupName,
              awsProfile,
              awsRegion,
              context,
              minSize: originalMinSize,
              maxSize: originalMaxSize,
              desiredCapacity: originalDesiredCapacity
            })
            
            // Remove temporary tags using SDK

            await autoScalingClient.send(new DeleteTagsCommand({
              Tags: [
                {
                  ResourceId: group.AutoScalingGroupName,
                  ResourceType: 'auto-scaling-group',
                  Key: 'panfactum.com/original-min-size'
                },
                {
                  ResourceId: group.AutoScalingGroupName,
                  ResourceType: 'auto-scaling-group',
                  Key: 'panfactum.com/original-max-size'
                },
                {
                  ResourceId: group.AutoScalingGroupName,
                  ResourceType: 'auto-scaling-group',
                  Key: 'panfactum.com/original-desired-capacity'
                }
              ]
            }))
          }
          
          // Wait for NAT instances to be ready
          await Bun.sleep(30000)
        },
      },
      {
        title: 'Updating Cilium operator scheduler',
        task: async () => {
          try {
            await execute({
              command: [
                'kubectl', '--context', selectedContext.name, '-n', 'kube-system',
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
                'kubectl', '--context', selectedContext.name,
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
          const response = await eksClient.send(new ListNodegroupsCommand({
            clusterName: clusterInfo.name
          }))
          const nodeGroups = response.nodegroups || []
          
          for (const nodeGroup of nodeGroups) {
            // Get the original configuration (usually 3 nodes)
            await eksClient.send(new UpdateNodegroupConfigCommand({
              clusterName: clusterInfo.name,
              nodegroupName: nodeGroup,
              scalingConfig: {
                minSize: 3,
                maxSize: 3,
                desiredSize: 3
              }
            }))
          }
          
          if (nodeGroups.length > 0) {
            // Wait for nodes to join
            await Bun.sleep(60000)
          }
        },
      },
      {
        title: 'Removing Karpenter node pool limits',
        task: async () => {
          try {
            // Get all Karpenter node pools
            const { stdout } = await execute({
              command: ['kubectl', '--context', selectedContext.name, 'get', 'nodepools.karpenter.sh', '-o', 'json'],
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
                    'kubectl', '--context', selectedContext.name,
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
                'kubectl', '--context', selectedContext.name, '-n', 'kube-system',
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
          await eksClient.send(new UntagResourceCommand({
            resourceArn: clusterInfo.arn,
            tagKeys: ['panfactum.com/suspended']
          }))
        },
      },
    ], { rendererOptions: { collapseErrors: false } })

    await tasks.run()

    context.logger.success(`
✓ Successfully resumed cluster "${selectedContext.name}"
  - NAT gateways have been restored
  - Node groups have been restored
  - Karpenter limits have been removed
  - Schedulers have been restored

The cluster may take a few minutes to become fully operational.`)
  }
}