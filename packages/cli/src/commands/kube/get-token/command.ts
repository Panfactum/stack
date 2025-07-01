// Command to get EKS authentication token with automatic SSO login handling
// Replaces the legacy pf-get-kube-token.sh script

import { Option } from 'clipanion'
import { getEKSToken } from '@/util/aws/getEKSToken.ts'
import { PanfactumCommand } from '@/util/command/panfactumCommand'
import { CLIError } from '@/util/error/error'

/**
 * Command for retrieving EKS authentication tokens
 * 
 * @deprecated This command is part of the deprecated 'kube' command group.
 * Consider using the newer cluster management commands.
 * 
 * @remarks
 * This command retrieves an EKS authentication token for kubectl access
 * with automatic AWS SSO login when needed. It:
 * 
 * - Generates EKS cluster authentication tokens
 * - Handles AWS SSO login automatically
 * - Works with kubectl authentication flows
 * - Outputs tokens in the expected format
 * 
 * @example
 * ```bash
 * # Get token for production cluster
 * pf kube get-token --cluster-name production-eks --region us-west-2
 * 
 * # Use with kubectl (typically configured automatically)
 * kubectl get pods --token=$(pf kube get-token --cluster production)
 * ```
 */
export default class K8sGetTokenCommand extends PanfactumCommand {
  static override paths = [['kube', 'get-token']]

  static override usage = PanfactumCommand.Usage({
    description: 'Get an EKS authentication token with automatic SSO login',
    category: 'Kubernetes',
    details: `
      This command retrieves an EKS authentication token using the AWS CLI. 
      If your SSO session has expired or doesn't exist, it will automatically 
      prompt you to log in via AWS SSO using the existing getIdentity utility.
    `,
    examples: [
      [
        'Get token for a cluster',
        '$0 k8s get-token --region us-east-1 --cluster-name my-cluster --profile my-profile',
      ],
    ],
  })

  region = Option.String('--region,-r', {
    description: 'AWS region of the EKS cluster',
    required: true,
  })
  
  clusterName = Option.String('--cluster-name,-c', {
    description: 'Name of the EKS cluster',
    required: true,
  })
  
  profile = Option.String('--profile,-p', {
    description: 'AWS profile to use for authentication',
    required: true,
  })

  override async execute(): Promise<number> {
    const { logger } = this.context

    try {
      // Get the EKS token using our utility that combines AWS SDK validation with CLI token generation
      const token = await getEKSToken({
        context: this.context,
        clusterName: this.clusterName,
        region: this.region,
        awsProfile: this.profile
      })
      
      logger.writeRaw(JSON.stringify(token))
      return 0
    } catch (error) {
      throw new CLIError(`Failed to get EKS token`, error)
    }
  }
}