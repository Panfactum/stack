// This command builds multi-platform container images using BuildKit
// It manages parallel builds for ARM64 and AMD64 architectures

import { dirname, basename } from 'path'
import { Option } from 'clipanion'
import { getBuildKitConfig } from '@/util/buildkit/config.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { CLIError } from '@/util/error/error.js'
import { directoryExists } from '@/util/fs/directoryExist.js'
import { fileExists } from '@/util/fs/fileExists.js'
import { getOpenPorts } from '@/util/network/getOpenPorts.js'
import { waitForPort } from '@/util/network/waitForPort.js'
import { execute } from '@/util/subprocess/execute.js'
import { killBackgroundProcess } from '@/util/subprocess/killBackgroundProcess.js'
import type { IBuildKitConfig } from '@/util/buildkit/constants.js'


/**
 * Command for building multi-platform container images using BuildKit
 * 
 * @remarks
 * This command orchestrates the building of container images for both
 * ARM64 and AMD64 architectures using remote BuildKit instances. It
 * handles the complete build pipeline including:
 * 
 * - Setting up secure tunnels to BuildKit instances
 * - Running parallel builds for each architecture
 * - Creating a multi-platform manifest
 * - Managing build cache in S3
 * - Cleaning up resources on completion
 * 
 * Key features:
 * - Parallel architecture builds for efficiency
 * - S3-backed build cache for performance
 * - Automatic tunnel management
 * - Multi-platform manifest creation
 * - Graceful cleanup on interruption
 * 
 * Prerequisites:
 * - BuildKit instances deployed in Kubernetes
 * - AWS ECR repository access
 * - Valid Dockerfile and build context
 * - S3 bucket for build cache
 * 
 * The command integrates with:
 * - AWS ECR for image storage
 * - S3 for distributed build cache
 * - Kubernetes for BuildKit access
 * - manifest-tool for multi-arch support
 * 
 * @example
 * ```bash
 * # Basic build
 * pf buildkit build --repo myapp --tag v1.0.0 --file ./Dockerfile --context .
 * 
 * # Build with custom arguments
 * pf buildkit build --repo myapp --tag latest --file ./docker/Dockerfile --context . -- --build-arg NODE_VERSION=18
 * 
 * # Build from subdirectory
 * pf buildkit build --repo api --tag feature-123 --file ./apps/api/Dockerfile --context ./apps/api
 * ```
 * 
 * @see {@link getBuildKitConfig} - For retrieving BuildKit configuration
 * @see {@link execute} - For running build commands
 * @see {@link getOpenPorts} - For finding available local ports
 */
export default class BuildkitBuildCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'build']]

  static override usage = PanfactumCommand.Usage({
    description: 'Submits a multi-platform container image build to BuildKit',
    category: 'BuildKit',
    details: `
Builds container images for multiple architectures using remote BuildKit instances.

This command:
1. Validates the Dockerfile and build context
2. Establishes tunnels to ARM64 and AMD64 BuildKit instances
3. Runs parallel builds for both architectures
4. Pushes images to ECR with architecture-specific tags
5. Creates a multi-platform manifest combining both architectures

The build cache is stored in S3 for improved performance across builds.
Any additional arguments after -- are passed directly to buildctl.
    `,
    examples: [
      [
        'Basic build',
        'pf buildkit build --repo myapp --tag v1.0.0 --file ./Dockerfile --context .'
      ],
      [
        'Build with arguments',
        'pf buildkit build --repo myapp --tag latest --file ./Dockerfile --context . -- --build-arg VERSION=1.0'
      ]
    ]
  })

  /**
   * ECR repository name for the built image
   * 
   * @remarks
   * This should be just the repository name, not the full URI.
   * The registry URL will be determined from BuildKit configuration.
   */
  repo = Option.String('--repo', {
    required: true,
    description: 'The name of the repository in the ECR container registry'
  })

  /**
   * Tag to apply to the built image
   * 
   * @remarks
   * Architecture suffixes (-arm64, -amd64) will be appended automatically
   * for individual builds before creating the final multi-arch tag.
   */
  tag = Option.String('--tag', {
    required: true,
    description: 'The tag for the generated image'
  })

  /**
   * Path to the Dockerfile
   * 
   * @remarks
   * Can be a relative or absolute path. The directory containing
   * the Dockerfile will be used as the dockerfile context.
   */
  file = Option.String('--file', {
    required: true,
    description: 'Path to the Dockerfile to use for the build'
  })

  /**
   * Path to the build context directory
   * 
   * @remarks
   * This directory contains the files that will be available
   * during the Docker build process.
   */
  buildContext = Option.String('--context', {
    required: true,
    description: 'Path to the build context'
  })

  /**
   * Additional arguments to pass to buildctl
   * 
   * @remarks
   * Everything after -- is passed directly to the buildctl command,
   * allowing for build arguments and other buildctl options.
   */
  rest = Option.Rest()

  /**
   * Process ID of the ARM64 tunnel
   * @internal
   */
  private armTunnelPid?: number
  
  /**
   * Process ID of the AMD64 tunnel
   * @internal
   */
  private amdTunnelPid?: number

  /**
   * Executes the multi-platform build command
   * 
   * @remarks
   * This method orchestrates the entire build process:
   * 1. Validates input files exist
   * 2. Retrieves BuildKit configuration
   * 3. Sets up cleanup handlers for graceful shutdown
   * 4. Starts tunnels to both BuildKit instances
   * 5. Runs parallel builds for ARM64 and AMD64
   * 6. Creates multi-platform manifest
   * 7. Cleans up all resources
   * 
   * The method ensures proper cleanup even if interrupted,
   * preventing orphaned tunnel processes.
   * 
   * @returns Exit code (0 for success, 1 for failure)
   * 
   * @throws {@link CLIError}
   * Throws when Dockerfile or build context doesn't exist,
   * or when unable to allocate required ports
   */
  async execute(): Promise<number> {
    // Validate dockerfile exists
    if (!(await fileExists({ filePath: this.file }))) {
      this.context.logger.error(`Dockerfile not found: ${this.file}`)
      return 1
    }

    // Validate build context exists
    if (!(await directoryExists({ path: this.buildContext }))) {
      this.context.logger.error(`Build context directory not found: ${this.buildContext}`)
      return 1
    }

    // Get configurations
    const config = await getBuildKitConfig({ context: this.context })

    // Set up cleanup handler
    process.on('SIGINT', () => this.cleanup())
    process.on('SIGTERM', () => this.cleanup())
    process.on('exit', () => this.cleanup())

    try {
      // Start tunnels for both architectures
      const [armPort, amdPort] = await getOpenPorts({ count: 2 })

      if (!armPort || !amdPort) {
        throw new CLIError('Failed to get required ports for BuildKit tunnels')
      }

      // Start ARM tunnel
      const armTunnelResult = await execute({
        command: [
          'pf',
          'buildkit',
          'tunnel',
          '--arch', 'arm64',
          '--port', armPort.toString()
        ],
        context: this.context,
        workingDirectory: process.cwd(),
        background: true,
        backgroundDescription: 'BuildKit ARM64 tunnel on port ' + armPort
      })
      
      this.armTunnelPid = armTunnelResult.pid

      // Start AMD tunnel
      const amdTunnelResult = await execute({
        command: [
          'pf',
          'buildkit',
          'tunnel',
          '--arch', 'amd64',
          '--port', amdPort.toString()
        ],
        context: this.context,
        workingDirectory: process.cwd(),
        background: true,
        backgroundDescription: 'BuildKit AMD64 tunnel on port ' + amdPort
      })
      
      this.amdTunnelPid = amdTunnelResult.pid

      // Wait for tunnels to be ready
      await waitForPort({ port: armPort })
      await waitForPort({ port: amdPort })

      // Run parallel builds
      const [armResult, amdResult] = await Promise.all([
        this.runBuild('arm64', armPort, config),
        this.runBuild('amd64', amdPort, config),
      ])

      if (armResult !== 0 || amdResult !== 0) {
        return 1
      }

      // Create multi-platform manifest
      await execute({
        command: [
          'manifest-tool',
          'push', 'from-args',
          '--platforms', 'linux/amd64,linux/arm64',
          '--template', `${config.registry}/${this.repo}:${this.tag}-ARCH`,
          '--target', `${config.registry}/${this.repo}:${this.tag}`
        ],
        context: this.context,
        workingDirectory: process.cwd()
      })

      return 0
    } finally {
      this.cleanup()
    }
  }


  /**
   * Runs a build for a specific architecture
   * 
   * @remarks
   * Executes buildctl with the appropriate parameters for the given
   * architecture. This includes:
   * - Setting the target platform (linux/arm64 or linux/amd64)
   * - Configuring S3-based import and export cache
   * - Pushing to ECR with architecture-specific tag
   * - Streaming build output with architecture prefix
   * 
   * The method handles errors gracefully and returns appropriate
   * exit codes for the parent process to handle.
   * 
   * @param arch - Target architecture (arm64 or amd64)
   * @param port - Local port for BuildKit connection
   * @param config - BuildKit configuration including registry and cache settings
   * @returns Exit code from buildctl (0 for success)
   * 
   * @internal
   */
  private async runBuild(arch: string, port: number, config: IBuildKitConfig): Promise<number> {
    try {
      const result = await execute({
        command: [
          'buildctl',
          'build',
          '--frontend=dockerfile.v0',
          '--output', `type=image,name=${config.registry}/${this.repo}:${this.tag}-${arch},push=true`,
          '--local', `context=${this.buildContext}`,
          '--local', `dockerfile=${dirname(this.file)}`,
          '--opt', `filename=./${basename(this.file)}`,
          '--opt', `platform=linux/${arch}`,
          '--export-cache', `type=s3,region=${config.cache_bucket_region},bucket=${config.cache_bucket},name=${config.registry}/${this.repo}`,
          '--import-cache', `type=s3,region=${config.cache_bucket_region},bucket=${config.cache_bucket},name=${config.registry}/${this.repo}`,
          '--progress', 'plain',
          ...(this.rest || [])
        ],
        context: this.context,
        workingDirectory: process.cwd(),
        env: {
          ...process.env,
          BUILDKIT_HOST: `tcp://127.0.0.1:${port}`
        },
        onStdOutNewline: (line) => {
          this.context.logger.writeRaw(`${arch}: ${line}`)
        },
        onStdErrNewline: (line) => {
          this.context.logger.writeRaw(`${arch}: ${line}`)
        }
      })

      return result.exitCode
    } catch (error) {
      this.context.logger.error(`Build failed for ${arch}: ${error instanceof Error ? error.message : String(error)}`)
      return 1
    }
  }

  /**
   * Cleans up tunnel processes
   * 
   * @remarks
   * Ensures all background tunnel processes are properly terminated.
   * This method is called:
   * - On successful completion
   * - On error conditions
   * - On process interruption (SIGINT/SIGTERM)
   * 
   * Uses the centralized killBackgroundProcess utility to ensure
   * proper process termination across different platforms.
   * 
   * @internal
   */
  private cleanup(): void {
    // Kill tunnel processes using the centralized utility
    if (this.armTunnelPid) {
      killBackgroundProcess({ 
        pid: this.armTunnelPid, 
        context: this.context 
      })
    }
    if (this.amdTunnelPid) {
      killBackgroundProcess({ 
        pid: this.amdTunnelPid, 
        context: this.context 
      })
    }
  }
}