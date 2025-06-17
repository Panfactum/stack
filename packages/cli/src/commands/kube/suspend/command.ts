import { confirm } from '@inquirer/prompts'
import { Command, Option } from 'clipanion'
import { Listr } from 'listr2'
import {
  AUTO_SCALING_GROUPS_WITH_SIZING_SCHEMA,
  EC2_INSTANCES_SCHEMA,
  EKS_DESCRIBE_CLUSTER_SCHEMA,
  EKS_LIST_NODEGROUPS_SCHEMA,
  KUBERNETES_ITEMS_SCHEMA,
  LOAD_BALANCERS_SCHEMA
} from '@/util/aws/schemas.ts'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import { validateRootProfile } from '@/util/eks/validateRootProfile.ts'
import { CLIError } from '@/util/error/error'
import { getAWSProfileForContext } from '@/util/kube/getProfileForContext.ts'
import { execute } from '@/util/subprocess/execute.ts'
import { parseJson } from '@/util/zod/parseJson'
import type { EksClusterInfo, AutoScalingGroup } from '@/util/eks/types.ts'

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
        '$0 k8s cluster suspend --cluster production-eks',
      ],
    ],
  })

  cluster = Option.String('--cluster', {
    required: true,
    description: 'Name of the EKS cluster to suspend',
  })

  async execute() {
    const { context } = this
    let clusterInfo: EksClusterInfo
    let nodeGroups: string[] = []
    let autoScalingGroups: AutoScalingGroup[] = []
    let awsProfile: string

    // Confirm dangerous operation
    const confirmed = await confirm({
      message: `Are you sure you want to suspend the cluster "${this.cluster}"? This will make it completely unavailable!`,
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
          awsProfile = await getAWSProfileForContext(context, this.cluster)
          await validateRootProfile(awsProfile, context)
        },
      },
      {
        title: 'Getting cluster information',
        task: async () => {
          const { stdout } = await execute({
            command: ['aws', 'eks', 'describe-cluster', '--name', this.cluster, '--output', 'json'],
            context,
            workingDirectory: process.cwd(),
          })
          const result = parseJson(EKS_DESCRIBE_CLUSTER_SCHEMA, stdout)
          clusterInfo = result.cluster
          
          if (clusterInfo.tags?.['panfactum.com/suspended'] === 'true') {
            throw new CLIError('Cluster is already suspended')
          }
        },
      },
      {
        title: 'Tagging cluster as suspended',
        task: async () => {
          await execute({
            command: ['aws', 'eks', 'tag-resource', '--resource-arn', clusterInfo.arn, '--tags', 'panfactum.com/suspended=true'],
            context,
            workingDirectory: process.cwd(),
          })
        },
      },
      {
        title: 'Extending certificate expiration',
        task: async () => {
          // Update certificate validity to 90 days
          try {
            await execute({
              command: [
                'kubectl', '--context', this.cluster, 
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
              command: ['kubectl', '--context', this.cluster, 'get', 'nodepools.karpenter.sh', '-o', 'json'],
              context,
              workingDirectory: process.cwd(),
            })
            
            const result = parseJson(KUBERNETES_ITEMS_SCHEMA, stdout)
            const nodePools = result.items || []
            
            for (const nodePool of nodePools) {
              // Set limits to 0
              await execute({
                command: [
                  'kubectl', '--context', this.cluster, 
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
          const { stdout } = await execute({
            command: ['aws', 'eks', 'list-nodegroups', '--cluster-name', this.cluster, '--output', 'json'],
            context,
            workingDirectory: process.cwd(),
          })
          const result = parseJson(EKS_LIST_NODEGROUPS_SCHEMA, stdout)
          nodeGroups = result.nodegroups || []
        },
      },
      {
        title: 'Scaling down EKS node groups',
        task: async () => {
          for (const nodeGroup of nodeGroups) {
            await execute({
              command: [
                'aws', 'eks', 'update-nodegroup-config', 
                '--cluster-name', this.cluster, 
                '--nodegroup-name', nodeGroup, 
                '--scaling-config', 'minSize=0,maxSize=0,desiredSize=0'
              ],
              context,
              workingDirectory: process.cwd(),
            })
          }
        },
      },
      {
        title: 'Terminating EC2 instances',
        task: async () => {
          // Get all instances for this cluster
          const { stdout } = await execute({
            command: [
              'aws', 'ec2', 'describe-instances', 
              '--filters', `Name=tag:kubernetes.io/cluster/${this.cluster},Values=owned`, 
              'Name=instance-state-name,Values=running', 
              '--query', 'Reservations[*].Instances[*].InstanceId', 
              '--output', 'json'
            ],
            context,
            workingDirectory: process.cwd(),
          })
          
          const result = parseJson(EC2_INSTANCES_SCHEMA, stdout)
          const instances = result.flat()
          
          if (instances.length > 0) {
            await execute({
              command: ['aws', 'ec2', 'terminate-instances', '--instance-ids', ...instances],
              context,
              workingDirectory: process.cwd(),
            })
          }
        },
      },
      {
        title: 'Finding NAT gateway Auto Scaling Groups',
        task: async () => {
          const { stdout } = await execute({
            command: [
              'aws', 'autoscaling', 'describe-auto-scaling-groups', 
              '--query', `AutoScalingGroups[?contains(AutoScalingGroupName, 'nat') && Tags[?Key=='kubernetes.io/cluster/${this.cluster}' && Value=='owned']]`, 
              '--output', 'json'
            ],
            context,
            workingDirectory: process.cwd(),
          })
          
          const groups = parseJson(AUTO_SCALING_GROUPS_WITH_SIZING_SCHEMA, stdout)
          autoScalingGroups = groups.map(g => ({
            name: g.AutoScalingGroupName,
            minSize: g.MinSize,
            maxSize: g.MaxSize,
            desiredCapacity: g.DesiredCapacity,
          }))
        },
      },
      {
        title: 'Scaling down NAT gateways',
        task: async () => {
          for (const asg of autoScalingGroups) {
            // Tag with original values for restoration
            await execute({
              command: [
                'aws', 'autoscaling', 'create-or-update-tags', '--tags',
                `ResourceId=${asg.name},ResourceType=auto-scaling-group,Key=panfactum.com/original-min-size,Value=${asg.minSize},PropagateAtLaunch=false`,
                `ResourceId=${asg.name},ResourceType=auto-scaling-group,Key=panfactum.com/original-max-size,Value=${asg.maxSize},PropagateAtLaunch=false`,
                `ResourceId=${asg.name},ResourceType=auto-scaling-group,Key=panfactum.com/original-desired-capacity,Value=${asg.desiredCapacity},PropagateAtLaunch=false`
              ],
              context,
              workingDirectory: process.cwd(),
            })
            
            // Scale to zero
            await execute({
              command: [
                'aws', 'autoscaling', 'update-auto-scaling-group', 
                '--auto-scaling-group-name', asg.name, 
                '--min-size', '0', '--max-size', '0', '--desired-capacity', '0'
              ],
              context,
              workingDirectory: process.cwd(),
            })
          }
        },
      },
      {
        title: 'Deleting load balancers',
        task: async () => {
          // Get all load balancers for this cluster
          const { stdout } = await execute({
            command: [
              'aws', 'elbv2', 'describe-load-balancers', 
              '--query', `LoadBalancers[?contains(LoadBalancerArn, '${this.cluster}')]`, 
              '--output', 'json'
            ],
            context,
            workingDirectory: process.cwd(),
          })
          
          const loadBalancers = parseJson(LOAD_BALANCERS_SCHEMA, stdout)
          
          for (const lb of loadBalancers) {
            await execute({
              command: ['aws', 'elbv2', 'delete-load-balancer', '--load-balancer-arn', lb.LoadBalancerArn],
              context,
              workingDirectory: process.cwd(),
            })
          }
        },
      },
    ], { rendererOptions: { collapseErrors: false } })

    await tasks.run()

    context.logger.info('')
    context.logger.success(`✓ Successfully suspended cluster "${this.cluster}"`)
    context.logger.info('  - All nodes have been terminated')
    context.logger.info('  - NAT gateways have been scaled down')
    context.logger.info('  - Load balancers have been deleted')
    context.logger.info('')
    context.logger.info(`To resume the cluster, run: pf k8s cluster resume --cluster ${this.cluster}`)
  }
}