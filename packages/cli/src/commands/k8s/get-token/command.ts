// Command to get EKS authentication token with automatic SSO login handling
// Replaces the legacy pf-get-kube-token.sh script

import { Option } from 'clipanion'
import { getIdentity } from '@/util/aws/getIdentity'
import { PanfactumCommand } from '@/util/command/panfactumCommand'
import { CLIError } from '@/util/error/error'
import { execute } from '@/util/subprocess/execute'

export default class K8sGetTokenCommand extends PanfactumCommand {
  static override paths = [['k8s', 'get-token']]

  static override usage = PanfactumCommand.Usage({
    description: 'Get an EKS authentication token with automatic SSO login handling',
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
      // Ensure we have valid AWS credentials by getting identity
      // This will handle SSO login automatically if needed
      await getIdentity({ context: this.context, profile: this.profile })
      
      // Get the EKS token using AWS CLI (now that we know auth is working)
      const token = await this.getEKSToken()
      
      // Output the token as JSON (matching the original script behavior)
      logger.writeRaw(JSON.stringify(token) + '\n')
      return 0
    } catch (error) {
      if (error instanceof CLIError) {
        throw error
      }
      throw new CLIError(
        `Failed to get EKS token: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async getEKSToken(): Promise<unknown> {
    try {
      // Execute aws eks get-token command
      // Since getIdentity() already handled SSO, this should work
      const { stdout } = await execute({
        command: [
          'aws',
          '--region', this.region,
          '--profile', this.profile,
          'eks', 'get-token',
          '--cluster-name', this.clusterName,
          '--output', 'json'
        ],
        context: this.context,
        workingDirectory: process.cwd(),
      })
      
      return JSON.parse(stdout)
    } catch (error) {
      throw new CLIError(
        `Failed to get EKS token for cluster '${this.clusterName}' in region '${this.region}' with profile '${this.profile}'`,
        error instanceof Error ? error : undefined
      )
    }
  }
}