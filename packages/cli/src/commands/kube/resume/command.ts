import { DeleteTagsCommand, DescribeAutoScalingGroupsCommand } from '@aws-sdk/client-auto-scaling'
import { DescribeClusterCommand, UntagResourceCommand } from '@aws-sdk/client-eks'
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
import { getAllRegions } from '@/util/config/getAllRegions';
import { validateRootProfile } from '@/util/eks/validateRootProfile.ts'
import { CLIError } from '@/util/error/error'
import { parseJson } from '@/util/json/parseJson'
import { getAWSProfileForContext } from '@/util/kube/getAWSProfileForContext.ts'
import {getKubeContexts} from "@/util/kube/getKubeContexts.ts";
import { execute } from '@/util/subprocess/execute.ts'
import {MODULES} from "@/util/terragrunt/constants.ts";
import {buildDeployModuleTask} from "@/util/terragrunt/tasks/deployModuleTask.ts";
import { sleep } from '@/util/util/sleep'
import type { IEKSClusterInfo } from '@/util/eks/types.ts'

/**
 * Command for resuming a suspended EKS cluster
 * 
 * @deprecated This command is part of the deprecated 'kube' command group.
 * Consider using the newer cluster management commands.
 * 
 * @remarks
 * This command restores a previously suspended EKS cluster to full
 * operational state by reversing the suspension process:
 * 
 * - Scales node groups back to original sizes
 * - Waits for instances to become ready
 * - Removes suspension tags
 * - Restores cluster networking
 * 
 * The resume process automatically detects the original node group
 * configurations and restores them to their pre-suspension state.
 * 
 * @example
 * ```bash
 * # Resume production cluster
 * pf kube cluster-resume --kube-context production-eks
 * 
 * # Interactive cluster selection
 * pf kube cluster-resume
 * ```
 * 
 * @see {@link K8sClusterSuspendCommand} - For suspending clusters
 */
export class K8sClusterResumeCommand extends PanfactumCommand {
  static override paths = [['kube', 'cluster-resume']]

  static override usage = Command.Usage({
    description: 'Resume a suspended EKS cluster',
    category: 'Kubernetes',
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
    const kubeContexts = await getKubeContexts(context)

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

    const awsProfile: string = await getAWSProfileForContext({ context, kubeContext: selectedContext.name })
    const autoScalingClient = await getAutoScalingClient({ context, profile: awsProfile, region: awsRegion })
    const eksClient = await getEKSClient({ context, profile: awsProfile, region: awsRegion })

    let clusterInfo: IEKSClusterInfo

    const tasks = new Listr([
      {
        title: 'Validating AWS access',
        task: async () => {
          await validateRootProfile({ profile: awsProfile, context })
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
          await sleep(30000)
        },
      },
      {
        title: 'Updating Cilium operator scheduler',
        task: async () => {
          // Check if the Cilium operator deployment exists
          const { exitCode } = await execute({
            command: [
              'kubectl', '--context', selectedContext.name, '-n', 'cilium',
              'get', 'deployment', 'cilium-operator'
            ],
            context,
            workingDirectory: process.cwd(),
            isSuccess: () => true, // Don't throw on non-zero exit
          })

          if (exitCode !== 0) {
            context.logger.debug('Cilium operator deployment not found, skipping')
            return
          }

          // Update the scheduler name in the deployment spec to default-scheduler
          await execute({
            command: [
              'kubectl', '--context', selectedContext.name,
              'patch', 'deployment', 'cilium-operator', '-n', 'cilium',
              '--patch', JSON.stringify({
                spec: {
                  template: {
                    spec: {
                      schedulerName: 'default-scheduler'
                    }
                  }
                }
              })
            ],
            context,
            workingDirectory: process.cwd(),
          })
          context.logger.debug('Updated Cilium operator to use default-scheduler')
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
      await buildDeployModuleTask({
        taskTitle: "Restoring EKS node groups",
        context,
        environment: selectedRegion.environment,
        region: selectedRegion.name,
        skipIfAlreadyApplied: false,
        module: MODULES.AWS_EKS,
        etaWarningMessage: 'This may take up to 15 minutes.',
      }),
      {
        title: 'Removing Karpenter node pool limits',
        task: async () => {
          // Check if Karpenter is installed by looking for the CRD
          const { exitCode } = await execute({
            command: ['kubectl', '--context', selectedContext.name, 'get', 'crd', 'nodepools.karpenter.sh'],
            context,
            workingDirectory: process.cwd(),
            isSuccess: () => true, // Don't throw on non-zero exit
          })

          if (exitCode !== 0) {
            context.logger.debug('Karpenter not installed, skipping nodepool limits removal')
            return
          }

          // Karpenter is installed, get all node pools
          const { stdout } = await execute({
            command: ['kubectl', '--context', selectedContext.name, 'get', 'nodepools.karpenter.sh', '-o', 'json'],
            context,
            workingDirectory: process.cwd(),
          })
          
          const result = parseJson(KUBERNETES_ITEMS_SCHEMA, stdout)
          const nodePools = result.items || []
          
          for (const nodePool of nodePools) {
            // First check if limits exist
            const { stdout: limitsCheck } = await execute({
              command: [
                'kubectl', '--context', selectedContext.name,
                'get', 'nodepool', nodePool.metadata.name, 
                '-o', 'jsonpath={.spec.limits}'
              ],
              context,
              workingDirectory: process.cwd(),
            })
            
            // Only patch if limits actually exist
            if (limitsCheck && limitsCheck.trim() !== '') {
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
              context.logger.debug(`Removed limits from nodepool ${nodePool.metadata.name}`)
            } else {
              context.logger.debug(`No limits found for nodepool ${nodePool.metadata.name}, skipping`)
            }
          }
        },
      },
      {
        title: 'Restoring Panfactum scheduler',
        task: async () => {
          // Check if the scheduler deployment exists in the scheduler namespace
          const { exitCode } = await execute({
            command: [
              'kubectl', '--context', selectedContext.name, '-n', 'scheduler',
              'get', 'deployment', 'scheduler'
            ],
            context,
            workingDirectory: process.cwd(),
            isSuccess: () => true, // Don't throw on non-zero exit
          })

          if (exitCode !== 0) {
            context.logger.debug('Scheduler deployment not found in scheduler namespace, skipping')
            return
          }

          // Wait for the scheduler pod to be running (timeout after 5 minutes)
          const timeout = 300 // seconds
          const interval = 10 // seconds
          let elapsed = 0
          
          context.logger.debug('Waiting for scheduler pod to be running...')
          
          while (elapsed < timeout) {
            const { stdout: podStatus } = await execute({
              command: [
                'kubectl', '--context', selectedContext.name, '-n', 'scheduler',
                'get', 'pod', '-l', 'panfactum.com/workload=scheduler',
                '-o', 'jsonpath={.items[0].status.phase}'
              ],
              context,
              workingDirectory: process.cwd(),
              isSuccess: () => true,
            })

            if (podStatus === 'Running') {
              context.logger.debug('Scheduler pod is running')
              break
            }

            context.logger.debug(`Pod status: ${podStatus || 'not found'}. Waiting...`)
            await sleep(interval * 1000)
            elapsed += interval
          }

          if (elapsed >= timeout) {
            throw new CLIError('Timed out waiting for scheduler pod to be running')
          }

          // Now update Cilium operator to use the panfactum scheduler
          await execute({
            command: [
              'kubectl', '--context', selectedContext.name,
              'patch', 'deployment', 'cilium-operator', '-n', 'cilium',
              '--patch', JSON.stringify({
                spec: {
                  template: {
                    spec: {
                      schedulerName: 'panfactum'
                    }
                  }
                }
              })
            ],
            context,
            workingDirectory: process.cwd(),
          })
          context.logger.debug('Updated Cilium operator to use panfactum scheduler')
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

    context.logger.info('')
    context.logger.success(`✓ Successfully resumed cluster "${selectedContext.name}"`)
    context.logger.info('  - NAT gateways have been restored')
    context.logger.info('  - Node groups have been restored')
    context.logger.info('  - Karpenter limits have been removed')
    context.logger.info('  - Schedulers have been restored')
    context.logger.info('')
    context.logger.info('The cluster may take a few minutes to become fully operational.')
  }
}