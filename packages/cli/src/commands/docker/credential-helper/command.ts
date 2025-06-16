import { Command, Option } from 'clipanion'
import { getAWSProfileForContext } from '@/util/aws/getProfileForContext'
import { getBuildKitConfig } from '@/util/buildkit'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import { getCachedCredential, setCachedCredential } from '@/util/docker/credentialCache.ts'
import { getEcrToken } from '@/util/docker/getEcrToken.ts'
import { CLIError } from '@/util/error/error'
import { execute } from '@/util/subprocess/execute.ts'
import type { PanfactumContext } from '@/util/context/context'

export class DockerCredentialHelperCommand extends PanfactumCommand {
  static override paths = [['docker', 'credential-helper']]

  static override usage = Command.Usage({
    description: 'Docker credential helper for AWS ECR authentication',
    details: `
      This command implements the Docker credential helper protocol for AWS ECR.
      
      It should be configured in your Docker config as:
      {
        "credHelpers": {
          "public.ecr.aws": "panfactum",
          "123456789.dkr.ecr.us-east-1.amazonaws.com": "panfactum"
        }
      }
      
      The helper will be called automatically by Docker when pulling/pushing ECR images.
    `,
    examples: [
      [
        'Get credentials (called by Docker)',
        'echo "123456789.dkr.ecr.us-east-1.amazonaws.com" | $0 docker credential-helper get',
      ],
    ],
  })

  action = Option.String({ required: true })

  async execute() {
    const { context } = this
    switch (this.action) {
      case 'get':
        await this.handleGet(context)
        break
      case 'store':
        // No-op for ECR as tokens are temporary
        break
      case 'erase':
        // No-op for ECR as tokens are temporary
        break
      case 'list':
        await this.handleList()
        break
      default:
        throw new CLIError(`Unknown action: ${this.action}`)
    }
  }

  private extractRegistry(url: string): string {
    // Extract just the registry from a full image URL
    // e.g., "891377197483.dkr.ecr.us-east-2.amazonaws.com/demo-user-service:test-5"
    // becomes "891377197483.dkr.ecr.us-east-2.amazonaws.com"
    
    // For public ECR, just return as-is
    if (url.startsWith('public.ecr.aws')) {
      return 'public.ecr.aws'
    }
    
    // For private ECR, extract the registry part (before the first slash)
    const match = url.match(/^(\d+\.dkr\.ecr\.[^.]+\.amazonaws\.com)/)
    if (match && match[1]) {
      return match[1]
    }
    
    // If no match, return the original URL (let validation handle it)
    return url
  }

  private async handleGet(context: PanfactumContext) {
    const input = await this.readStdin()
    const fullUrl = input.trim()
    const registry = this.extractRegistry(fullUrl)

    if (!this.isEcrRegistry(registry)) {
      throw new CLIError('Not an ECR registry')
    }

    // Check cache first
    const cached = await getCachedCredential(context, registry)
    if (cached) {
      this.context.stdout.write(JSON.stringify({
        Username: cached.username,
        Secret: cached.token,
      }))
      return
    }

    // Get BuildKit config and use cluster context to determine AWS profile
    const buildkitConfig = await getBuildKitConfig(context)
    const awsProfile = await getAWSProfileForContext(context, buildkitConfig.cluster)

    // Get fresh token from ECR
    try {
      const { username, password } = await getEcrToken(context, registry, awsProfile)
      
      // Cache the credential
      await setCachedCredential(context, registry, password)

      // Output in Docker credential helper format
      this.context.stdout.write(JSON.stringify({
        Username: username,
        Secret: password,
      }))
    } catch (error) {
      // Check if SSO login is needed
      if (error instanceof Error && (error.message?.includes('SSO') || error.message?.includes('sso'))) {
        // Try to login to SSO
        if (awsProfile) {
          await execute({
            command: ['aws', 'sso', 'login', '--profile', awsProfile],
            context,
            workingDirectory: process.cwd(),
          })
          
          // Retry getting token
          const { username, password } = await getEcrToken(context, registry, awsProfile)
          await setCachedCredential(context, registry, password)

          this.context.stdout.write(JSON.stringify({
            Username: username,
            Secret: password,
          }))
        } else {
          throw error
        }
      } else {
        throw error
      }
    }
  }

  private async handleList() {
    // Return empty object as we don't store permanent credentials
    this.context.stdout.write('{}')
  }

  private isEcrRegistry(registry: string): boolean {
    return registry.includes('.ecr.')
  }

  private async readStdin(): Promise<string> {
    const chunks: globalThis.Buffer[] = []
    for await (const chunk of this.context.stdin) {
      chunks.push(chunk)
    }
    return globalThis.Buffer.concat(chunks).toString('utf8')
  }
}