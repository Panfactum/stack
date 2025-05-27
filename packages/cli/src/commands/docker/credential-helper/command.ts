import { Command, Option } from 'clipanion'
import { getBuildKitConfig } from '../../../util/buildkit/config'
import { PanfactumCommand } from '../../../util/command/panfactumCommand'
import { getCachedCredential, setCachedCredential } from '../../../util/docker/credentialCache'
import { getEcrToken } from '../../../util/docker/getEcrToken'
import { execute } from '../../../util/subprocess/execute'
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
        throw new Error(`Unknown action: ${this.action}`)
    }
  }

  private async handleGet(context: PanfactumContext) {
    const input = await this.readStdin()
    const registry = input.trim()

    if (!this.isEcrRegistry(registry)) {
      throw new Error('Not an ECR registry')
    }

    // Check cache first
    const cached = await getCachedCredential(registry)
    if (cached) {
      this.context.stdout.write(JSON.stringify({
        Username: cached.username,
        Secret: cached.token,
      }))
      return
    }

    // Determine AWS profile to use
    let awsProfile: string | undefined

    // Check BuildKit config for profile mapping
    try {
      const buildkitConfig = await getBuildKitConfig(context)
      const profileMapping = (buildkitConfig as Record<string, any>)['aws_profile_for_registry'] || {}
      awsProfile = profileMapping[registry]
    } catch {
      // BuildKit config not found, continue without profile
    }

    // Get fresh token from ECR
    try {
      const { username, password } = await getEcrToken(context, registry, awsProfile)
      
      // Cache the credential
      await setCachedCredential(registry, password, username)

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
          await setCachedCredential(registry, password, username)

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
    return registry.includes('.ecr.') || registry === 'public.ecr.aws'
  }

  private async readStdin(): Promise<string> {
    const chunks: globalThis.Buffer[] = []
    for await (const chunk of this.context.stdin) {
      chunks.push(chunk)
    }
    return globalThis.Buffer.concat(chunks).toString('utf8')
  }
}