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
import type { BuildKitConfig } from '@/util/buildkit/constants.js'

export default class BuildkitBuildCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'build']]

  static override usage = PanfactumCommand.Usage({
    description: 'Submits a multi-platform container image build to BuildKit',
    category: 'BuildKit',
  })

  repo = Option.String('--repo', {
    required: true,
    description: 'The name of the repository in the ECR container registry'
  })

  tag = Option.String('--tag', {
    required: true,
    description: 'The tag for the generated image'
  })

  file = Option.String('--file', {
    required: true,
    description: 'Path to the Dockerfile to use for the build'
  })

  buildContext = Option.String('--context', {
    required: true,
    description: 'Path to the build context'
  })

  rest = Option.Rest()

  private armTunnelPid?: number
  private amdTunnelPid?: number

  async execute(): Promise<number> {
    // Validate dockerfile exists
    if (!(await fileExists(this.file))) {
      this.context.logger.error(`Dockerfile not found: ${this.file}`)
      return 1
    }

    // Validate build context exists
    if (!(await directoryExists(this.buildContext))) {
      this.context.logger.error(`Build context directory not found: ${this.buildContext}`)
      return 1
    }

    // Get configurations
    const config = await getBuildKitConfig(this.context)

    // Set up cleanup handler
    process.on('SIGINT', () => this.cleanup())
    process.on('SIGTERM', () => this.cleanup())
    process.on('exit', () => this.cleanup())

    try {
      // Start tunnels for both architectures
      const [armPort, amdPort] = await getOpenPorts(2)

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


  private async runBuild(arch: string, port: number, config: BuildKitConfig): Promise<number> {
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