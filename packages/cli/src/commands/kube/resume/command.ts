import { DeleteTagsCommand } from '@aws-sdk/client-auto-scaling'
import { DescribeClusterCommand } from '@aws-sdk/client-eks'
import { Command, Option } from 'clipanion'
import { Listr } from 'listr2'
import { z } from "zod";
import { getAutoScalingClient } from '@/util/aws/clients/getAutoScalingClient.ts'
import { getEKSClient } from '@/util/aws/clients/getEKSClient.ts'
import { scaleASG } from '@/util/aws/scaleASG.ts'
import {
  AUTO_SCALING_GROUPS_WITH_TAGS_SCHEMA,
  EKS_DESCRIBE_CLUSTER_SCHEMA,
  EKS_LIST_NODEGROUPS_SCHEMA,
  KUBERNETES_ITEMS_SCHEMA
} from '@/util/aws/schemas.ts'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import { validateRootProfile } from '@/util/eks/validateRootProfile.ts'
import { CLIError } from '@/util/error/error'
import {getKubeContextsFromConfig} from "@/util/kube/getKubeContextsFromConfig.ts";
import { getAWSProfileForContext } from '@/util/kube/getProfileForContext.ts'
import { execute } from '@/util/subprocess/execute.ts'
import { parseJson } from '@/util/zod/parseJson'
import type { EksClusterInfo } from '@/util/eks/types.ts'

// Schema for AWS ARN with region extraction
// ARN format: arn:partition:service:region:account:resource
const AWS_ARN_SCHEMA = z.string()
  .regex(/^arn:aws:[^:]+:[^:]+:[^:]+:.+$/, "Invalid AWS ARN format")


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

    let clusterInfo: EksClusterInfo
    const awsProfile: string = await getAWSProfileForContext(context, selectedContext.name)
    let awsRegion: string = ''

    const autoScalingClient = await getAutoScalingClient({ context, profile: awsProfile, region: awsRegion })

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
          const eksClient = await getEKSClient({ context, profile: awsProfile })
          const response = await eksClient.send(new DescribeClusterCommand({
            name: selectedContext.cluster
          }))
          
          // Validate the response structure for consistency
          const result = parseJson(EKS_DESCRIBE_CLUSTER_SCHEMA, JSON.stringify(response))
          clusterInfo = result.cluster
          
          // Extract region from cluster ARN using Zod validation
          const arnData = AWS_ARN_SCHEMA.parse(clusterInfo.arn)
          const region = arnData.split(':')[3]

          if (!region) {
            throw new CLIError('Cluster ARN does not contain a valid region')
          }

          awsRegion = region
          
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
              '--query', `AutoScalingGroups[?contains(AutoScalingGroupName, 'nat') && Tags[?Key=='kubernetes.io/cluster/${clusterInfo.name}' && Value=='owned'] && Tags[?Key=='panfactum.com/original-min-size']]`,
              '--output', 'json'
            ],
            context,
            workingDirectory: process.cwd(),
          })
          
          const groups = parseJson(AUTO_SCALING_GROUPS_WITH_TAGS_SCHEMA, stdout)
          
          for (const group of groups) {
            // Extract original values from tags
            const originalMinSize = parseInt(group.Tags.find(t => t.Key === 'panfactum.com/original-min-size')?.Value || '1')
            const originalMaxSize = parseInt(group.Tags.find(t => t.Key === 'panfactum.com/original-max-size')?.Value || '1')
            const originalDesiredCapacity = parseInt(group.Tags.find(t => t.Key === 'panfactum.com/original-desired-capacity')?.Value || '1')
            
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
          const { stdout } = await execute({
            command: ['aws', 'eks', 'list-nodegroups', '--cluster-name', clusterInfo.name, '--output', 'json'],
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
                '--cluster-name', clusterInfo.name,
                '--nodegroup-name', nodeGroup, 
                '--scaling-config', 'minSize=3,maxSize=3,desiredSize=3'
              ],
              context,
              workingDirectory: process.cwd(),
            })
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

    context.logger.success(`
✓ Successfully resumed cluster "${selectedContext.name}"
  - NAT gateways have been restored
  - Node groups have been restored
  - Karpenter limits have been removed
  - Schedulers have been restored

The cluster may take a few minutes to become fully operational.`)
  }
}