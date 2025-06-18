import {
  DescribeAutoScalingGroupsCommand,
  CreateOrUpdateTagsCommand,
  UpdateAutoScalingGroupCommand
} from '@aws-sdk/client-auto-scaling'
import {
  DescribeInstancesCommand,
  TerminateInstancesCommand
} from '@aws-sdk/client-ec2'
import {
  DescribeClusterCommand,
  TagResourceCommand,
  ListNodegroupsCommand,
  UpdateNodegroupConfigCommand
} from '@aws-sdk/client-eks'
import {
  DescribeLoadBalancersCommand,
  DeleteLoadBalancerCommand
} from '@aws-sdk/client-elastic-load-balancing-v2'
import { confirm } from '@inquirer/prompts'
import { Command, Option } from 'clipanion'
import { Listr } from 'listr2'
import {getAutoScalingClient} from "@/util/aws/clients/getAutoScalingClient.ts";
import {getEC2Client} from "@/util/aws/clients/getEC2Client.ts";
import {getEKSClient} from "@/util/aws/clients/getEKSClient.ts";
import {getELBv2Client} from "@/util/aws/clients/getELBv2Client.ts";
import {
  EKS_DESCRIBE_CLUSTER_SCHEMA,
  KUBERNETES_ITEMS_SCHEMA,
} from '@/util/aws/schemas.ts'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import {getAllRegions} from "@/util/config/getAllRegions.ts";
import { validateRootProfile } from '@/util/eks/validateRootProfile.ts'
import { CLIError } from '@/util/error/error'
import {getKubeContextsFromConfig} from "@/util/kube/getKubeContextsFromConfig.ts";
import { getAWSProfileForContext } from '@/util/kube/getProfileForContext.ts'
import { execute } from '@/util/subprocess/execute.ts'
import { parseJson } from '@/util/zod/parseJson'
import type { EKSClusterInfo, AutoScalingGroup } from '@/util/eks/types.ts'

export class K8sClusterSuspendCommand extends PanfactumCommand {
  static override paths = [['kube', 'cluster-suspend']]

  static override usage = Command.Usage({
    description: 'Suspend an EKS cluster to save costs by removing all nodes',
    details: `
      This command suspends an EKS cluster by:
      - Tagging the cluster as suspended
      - Extending certificate expiration
      - Scaling down all node pools to zero
      - Terminating EC2 instances
      - Scaling down NAT gateways
      - Deleting load balancers
      
      The cluster configuration is preserved and can be restored with 'pf k8s cluster resume'.
      
      WARNING: This will make the cluster completely unavailable!
    `,
    examples: [
      [
        'Suspend a cluster',
        '$0 k8s cluster suspend --kube-context production-eks',
      ],
    ],
  })

  kubeContext = Option.String('--kube-context', {
    description: 'Name of the Kube Context to suspend',
  })

  async execute() {
    const { context } = this
    const kubeContexts = await getKubeContextsFromConfig(context)

    const selectedContext = this.kubeContext
      ? kubeContexts.find(context => context.name === this.kubeContext)
      : await context.logger.select({
        message: "Select the Cluster context you want to suspend:",
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
    const ec2Client = await getEC2Client({ context, profile: awsProfile, region: awsRegion })
    const elbv2Client = await getELBv2Client({ context, profile: awsProfile, region: awsRegion })

    let clusterInfo: EKSClusterInfo
    let nodeGroups: string[] = []
    let autoScalingGroups: AutoScalingGroup[] = []

    // Confirm dangerous operation
    const confirmed = await confirm({
      message: `Are you sure you want to suspend the cluster "${selectedContext.name}"? This will make it completely unavailable!`,
      default: false,
    })

    if (!confirmed) {
      context.logger.info('Operation cancelled')
      return
    }

    const tasks = new Listr([
      {
        title: 'Validating AWS access',
        task: async () => {
          await validateRootProfile(awsProfile, context)
        },
      },
      {
        title: 'Getting cluster information',
        task: async () => {
          const response = await eksClient.send(new DescribeClusterCommand({
            name: selectedContext.cluster
          }))
          
          // Validate the response structure for consistency
          const result = parseJson(EKS_DESCRIBE_CLUSTER_SCHEMA, JSON.stringify(response))
          clusterInfo = result.cluster
          
          if (clusterInfo.tags?.['panfactum.com/suspended'] === 'true') {
            throw new CLIError('Cluster is already suspended')
          }
        },
      },
      {
        title: 'Tagging cluster as suspended',
        task: async () => {
          await eksClient.send(new TagResourceCommand({
            resourceArn: clusterInfo.arn,
            tags: {
              'panfactum.com/suspended': 'true'
            }
          }))
        },
      },
      {
        title: 'Extending certificate expiration',
        task: async () => {
          // Update certificate validity to 90 days
          try {
            await execute({
              command: [
                'kubectl', '--context', selectedContext.name, 
                'patch', 'configmap/kubeadm-config', '-n', 'kube-system', 
                '--type', 'merge', '-p', 
                '{"data":{"ClusterConfiguration":"apiServer:\\n  extraArgs:\\n    client-ca-file: /etc/kubernetes/pki/ca.crt\\n    tls-cert-file: /etc/kubernetes/pki/apiserver.crt\\n    tls-private-key-file: /etc/kubernetes/pki/apiserver.key\\n  certSANs:\\n  - localhost\\n  - 127.0.0.1\\ncontrollerManager:\\n  extraArgs:\\n    cluster-signing-duration: 2160h\\n"}}'
              ],
              context,
              workingDirectory: process.cwd(),
            })
          } catch {
            // Ignore errors, this might not work on all clusters
          }
        },
      },
      {
        title: 'Scaling down Karpenter node pools',
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
              // Set limits to 0
              await execute({
                command: [
                  'kubectl', '--context', selectedContext.name, 
                  'patch', 'nodepool', nodePool.metadata.name, 
                  '--type', 'merge', '-p', '{"spec":{"limits":{"cpu":"0","memory":"0"}}}'
                ],
                context,
                workingDirectory: process.cwd(),
              })
            }
          } catch {
            // Karpenter might not be installed
          }
        },
      },
      {
        title: 'Getting EKS node groups',
        task: async () => {
          const response = await eksClient.send(new ListNodegroupsCommand({
            clusterName: selectedContext.cluster
          }))
          nodeGroups = response.nodegroups || []
        },
      },
      {
        title: 'Scaling down EKS node groups',
        task: async () => {
          for (const nodeGroup of nodeGroups) {
            await eksClient.send(new UpdateNodegroupConfigCommand({
              clusterName: selectedContext.cluster,
              nodegroupName: nodeGroup,
              scalingConfig: {
                minSize: 0,
                maxSize: 0,
                desiredSize: 0
              }
            }))
          }
        },
      },
      {
        title: 'Terminating EC2 instances',
        task: async () => {
          // Get all instances for this cluster
          const response = await ec2Client.send(new DescribeInstancesCommand({
            Filters: [
              {
                Name: `tag:kubernetes.io/cluster/${selectedContext.cluster}`,
                Values: ['owned']
              },
              {
                Name: 'instance-state-name',
                Values: ['running']
              }
            ]
          }))
          
          const instances: string[] = []
          response.Reservations?.forEach(reservation => {
            reservation.Instances?.forEach(instance => {
              if (instance.InstanceId) {
                instances.push(instance.InstanceId)
              }
            })
          })
          
          if (instances.length > 0) {
            await ec2Client.send(new TerminateInstancesCommand({
              InstanceIds: instances
            }))
          }
        },
      },
      {
        title: 'Finding NAT gateway Auto Scaling Groups',
        task: async () => {
          const response = await autoScalingClient.send(new DescribeAutoScalingGroupsCommand({}))
          
          // Filter groups matching our criteria
          const groups = (response.AutoScalingGroups || []).filter(asg => {
            if (!asg.AutoScalingGroupName?.includes('nat')) return false
            
            const tags = asg.Tags || []
            const hasClusterTag = tags.some(tag => 
              tag.Key === `kubernetes.io/cluster/${selectedContext.cluster}` && tag.Value === 'owned'
            )
            
            return hasClusterTag
          })
          
          autoScalingGroups = groups.map(g => ({
            name: g.AutoScalingGroupName!,
            minSize: g.MinSize || 0,
            maxSize: g.MaxSize || 0,
            desiredCapacity: g.DesiredCapacity || 0,
          }))
        },
      },
      {
        title: 'Scaling down NAT gateways',
        task: async () => {
          for (const asg of autoScalingGroups) {
            // Tag with original values for restoration
            await autoScalingClient.send(new CreateOrUpdateTagsCommand({
              Tags: [
                {
                  ResourceId: asg.name,
                  ResourceType: 'auto-scaling-group',
                  Key: 'panfactum.com/original-min-size',
                  Value: String(asg.minSize),
                  PropagateAtLaunch: false
                },
                {
                  ResourceId: asg.name,
                  ResourceType: 'auto-scaling-group',
                  Key: 'panfactum.com/original-max-size',
                  Value: String(asg.maxSize),
                  PropagateAtLaunch: false
                },
                {
                  ResourceId: asg.name,
                  ResourceType: 'auto-scaling-group',
                  Key: 'panfactum.com/original-desired-capacity',
                  Value: String(asg.desiredCapacity),
                  PropagateAtLaunch: false
                }
              ]
            }))
            
            // Scale to zero
            await autoScalingClient.send(new UpdateAutoScalingGroupCommand({
              AutoScalingGroupName: asg.name,
              MinSize: 0,
              MaxSize: 0,
              DesiredCapacity: 0
            }))
          }
        },
      },
      {
        title: 'Deleting load balancers',
        task: async () => {
          // Get all load balancers
          const response = await elbv2Client.send(new DescribeLoadBalancersCommand({}))
          
          // Filter load balancers that contain the cluster name in their ARN
          const loadBalancers = (response.LoadBalancers || []).filter(lb => 
            lb.LoadBalancerArn?.includes(selectedContext.cluster)
          )
          
          for (const lb of loadBalancers) {
            if (lb.LoadBalancerArn) {
              await elbv2Client.send(new DeleteLoadBalancerCommand({
                LoadBalancerArn: lb.LoadBalancerArn
              }))
            }
          }
        },
      },
    ], { rendererOptions: { collapseErrors: false } })

    await tasks.run()

    context.logger.info('')
    context.logger.success(`✓ Successfully suspended cluster "${selectedContext.name}"`)
    context.logger.info('  - All nodes have been terminated')
    context.logger.info('  - NAT gateways have been scaled down')
    context.logger.info('  - Load balancers have been deleted')
    context.logger.info('')
    context.logger.info(`To resume the cluster, run: pf k8s cluster resume --kube-context ${selectedContext.name}`)
  }
}