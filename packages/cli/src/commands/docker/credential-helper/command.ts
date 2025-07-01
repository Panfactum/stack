// This command implements Docker credential helper protocol for AWS ECR
// It's part of the deprecated docker command group

import { Command, Option } from 'clipanion'
import { getBuildKitConfig } from '@/util/buildkit/config'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import { getECRToken, parseECRToken } from '@/util/docker/getECRToken.ts'
import { CLIError } from '@/util/error/error'
import { getAWSProfileForContext } from '@/util/kube/getAWSProfileForContext'
import { execute } from '@/util/subprocess/execute.ts'
import type { PanfactumContext } from '@/util/context/context'

/**
 * Docker credential helper for AWS ECR authentication
 * 
 * @deprecated This command is part of the deprecated 'docker' command group.
 * Consider using the newer container registry authentication features.
 * 
 * @remarks
 * This command implements the Docker credential helper protocol to provide
 * seamless authentication with AWS Elastic Container Registry (ECR). It:
 * 
 * - Handles credential requests from Docker daemon
 * - Retrieves temporary ECR tokens automatically
 * - Supports both public and private ECR registries
 * - Manages AWS SSO login when needed
 * - Caches tokens for performance
 * 
 * Docker credential helper protocol:
 * - **get**: Retrieve credentials for a registry
 * - **store**: Save credentials (no-op for ECR)
 * - **erase**: Remove credentials (no-op for ECR)
 * - **list**: List stored credentials (returns empty)
 * 
 * Configuration:
 * Add to ~/.docker/config.json:
 * ```json
 * {
 *   "credHelpers": {
 *     "public.ecr.aws": "panfactum",
 *     "123456789.dkr.ecr.us-east-1.amazonaws.com": "panfactum"
 *   }
 * }
 * ```
 * 
 * The helper integrates with:
 * - BuildKit configuration for AWS profile detection
 * - ECR token generation with 12-hour validity
 * - AWS SSO for authentication
 * 
 * @example
 * ```bash
 * # Usually called automatically by Docker
 * echo "123456789.dkr.ecr.us-east-1.amazonaws.com" | pf docker credential-helper get
 * 
 * # Manual test
 * docker pull 123456789.dkr.ecr.us-east-1.amazonaws.com/myimage:latest
 * # Docker automatically calls this helper
 * ```
 * 
 * @see {@link getECRToken} - For ECR token retrieval
 * @see {@link getAWSProfileForContext} - For AWS profile resolution
 */
export class DockerCredentialHelperCommand extends PanfactumCommand {
  static override paths = [['docker', 'credential-helper']]

  static override usage = Command.Usage({
    description: 'Docker credential helper for AWS ECR authentication',
    category: 'Docker',
    details: `
[DEPRECATED] This command is part of the deprecated 'docker' command group.

Implements the Docker credential helper protocol for AWS ECR.

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
        'echo "123456789.dkr.ecr.us-east-1.amazonaws.com" | pf docker credential-helper get',
      ],
      [
        'Test with docker pull',
        'docker pull 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:latest'
      ]
    ],
  })

  /**
   * Credential helper action to perform
   * 
   * @remarks
   * Must be one of: get, store, erase, list
   * This follows the Docker credential helper protocol.
   */
  action = Option.String({ required: true })

  /**
   * Executes the credential helper action
   * 
   * @remarks
   * Routes to the appropriate handler based on the action:
   * - get: Retrieves ECR credentials
   * - store: No-op (ECR tokens are temporary)
   * - erase: No-op (ECR tokens are temporary)
   * - list: Returns empty object
   * 
   * The 'get' action is the primary operation, handling
   * token retrieval and SSO authentication as needed.
   * 
   * @throws {@link CLIError}
   * Throws when action is unknown or credential retrieval fails
   */
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

  /**
   * Extracts registry URL from a full image reference
   * 
   * @remarks
   * Handles both public and private ECR registry formats:
   * - Public: public.ecr.aws
   * - Private: {account}.dkr.ecr.{region}.amazonaws.com
   * 
   * @internal
   */
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

  /**
   * Handles the 'get' action for credential retrieval
   * 
   * @remarks
   * This method:
   * 1. Reads registry URL from stdin
   * 2. Validates it's an ECR registry
   * 3. Determines AWS profile from BuildKit config
   * 4. Retrieves ECR authentication token
   * 5. Handles SSO login if needed
   * 6. Outputs credentials in Docker format
   * 
   * @internal
   */
  private async handleGet(context: PanfactumContext) {
    const input = await this.readStdin()
    const fullUrl = input.trim()
    const registry = this.extractRegistry(fullUrl)

    if (!this.isEcrRegistry(registry)) {
      throw new CLIError('Not an ECR registry')
    }

    // Get BuildKit config and use cluster context to determine AWS profile
    const buildkitConfig = await getBuildKitConfig({ context })
    const awsProfile = await getAWSProfileForContext({ context, kubeContext: buildkitConfig.cluster })

    // Get token from ECR (with caching)
    const token = await getECRToken({ context, registry, awsProfile })
      .catch(async (error: unknown) => {
        // Check if SSO login is needed
        if (error instanceof Error && (error.message?.includes('SSO') || error.message?.includes('sso'))) {
          // Try to login to SSO
          if (awsProfile) {
            await execute({
              command: ['aws', 'sso', 'login', '--profile', awsProfile],
              context,
              workingDirectory: process.cwd(),
            }).catch((ssoError: unknown) => {
              throw new CLIError(
                `Failed to login to AWS SSO for profile '${awsProfile}'`,
                ssoError
              )
            })
            
            // Retry getting token (skip cache to get fresh token after SSO login)
            return getECRToken({ context, registry, awsProfile, skipCache: true })
              .catch((retryError: unknown) => {
                throw new CLIError(
                  `Failed to get ECR token after SSO login for registry '${registry}'`,
                  retryError
                )
              })
          }
        }
        throw new CLIError(
          `Failed to get ECR token for registry '${registry}'`,
          error
        )
      })
    
    const { username, password } = parseECRToken(token)

    // Output in Docker credential helper format
    this.context.stdout.write(JSON.stringify({
      Username: username,
      Secret: password
    }))
  }

  /**
   * Handles the 'list' action
   * 
   * @remarks
   * Returns empty object as ECR uses temporary tokens
   * that aren't stored permanently.
   * 
   * @internal
   */
  private async handleList() {
    // Return empty object as we don't store permanent credentials
    this.context.stdout.write('{}')
  }

  /**
   * Checks if a registry URL is an ECR registry
   * 
   * @internal
   */
  private isEcrRegistry(registry: string): boolean {
    return registry.includes('.ecr.')
  }

  /**
   * Reads input from stdin
   * 
   * @remarks
   * Used to receive registry URL from Docker daemon
   * following the credential helper protocol.
   * 
   * @internal
   */
  private async readStdin(): Promise<string> {
    const chunks: globalThis.Buffer[] = []
    for await (const chunk of this.context.stdin) {
      chunks.push(chunk)
    }
    return globalThis.Buffer.concat(chunks).toString('utf8')
  }
}