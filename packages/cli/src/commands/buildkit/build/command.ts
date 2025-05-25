import { ChildProcess, spawn } from 'child_process'
import { existsSync } from 'fs'
import { dirname, basename, join } from 'path'
import { Option } from 'clipanion'
import { getBuildKitConfig } from '@/util/buildkit/config.js'
import type { BuildKitConfig } from '@/util/buildkit/constants.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { getOpenPort } from '@/util/network/getOpenPort.js'
import { execute } from '@/util/subprocess/execute.js'

export default class BuildkitBuildCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'build']]

  static override usage = PanfactumCommand.Usage({
    description: 'Submits a multi-platform container build to BuildKit'
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
  private armBuildProcess?: ChildProcess
  private amdBuildProcess?: ChildProcess

  async execute(): Promise<number> {
    // Validate dockerfile exists
    if (!existsSync(this.file)) {
      this.context.logger.error(`Dockerfile not found: ${this.file}`)
      return 1
    }

    // Validate build context exists
    if (!existsSync(this.buildContext)) {
      this.context.logger.error(`Build context not found: ${this.buildContext}`)
      return 1
    }

    // Get configurations
    const config = await getBuildKitConfig(this.context)
    const buildkitDir = this.context.repoVariables.buildkit_dir

    // Set up cleanup handler
    process.on('SIGINT', () => this.cleanup())
    process.on('SIGTERM', () => this.cleanup())
    process.on('exit', () => this.cleanup())

    try {
      // Start tunnels for both architectures
      const armPort = await getOpenPort()
      const amdPort = await getOpenPort()

      // Start ARM tunnel
      const armTunnelProcess = spawn('pf', [
        'buildkit',
        'tunnel',
        '--arch', 'arm64',
        '--port', armPort.toString()
      ], {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          AUTOSSH_PIDFILE: join(buildkitDir, 'arm.pid')
        }
      })
      this.armTunnelPid = armTunnelProcess.pid

      // Start AMD tunnel
      const amdTunnelProcess = spawn('pf', [
        'buildkit',
        'tunnel',
        '--arch', 'amd64',
        '--port', amdPort.toString()
      ], {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          AUTOSSH_PIDFILE: join(buildkitDir, 'amd.pid')
        }
      })
      this.amdTunnelPid = amdTunnelProcess.pid

      // Wait for tunnels to be ready
      await this.waitForTunnel(armPort)
      await this.waitForTunnel(amdPort)

      // Run parallel builds
      const [armResult, amdResult] = await Promise.all([
        this.runBuild('arm64', armPort, config),
        this.runBuild('amd64', amdPort, config)
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

  private async waitForTunnel(port: number, maxAttempts = 30): Promise<void> {
    const { default: net } = await import('net')
    
    for (let i = 0; i < maxAttempts; i++) {
      const connected = await new Promise<boolean>((resolve) => {
        const socket = net.createConnection(port, '127.0.0.1')
        socket.on('connect', () => {
          socket.end()
          resolve(true)
        })
        socket.on('error', () => {
          resolve(false)
        })
      })

      if (connected) {
        return
      }

      await new Promise(resolve => globalThis.setTimeout(resolve, 1000))
    }

    throw new Error(`Tunnel on port ${port} did not become available`)
  }

  private async runBuild(arch: string, port: number, config: BuildKitConfig): Promise<number> {
    return new Promise((resolve) => {
      const buildProcess = spawn('buildctl', [
        'build',
        '--frontend=dockerfile.v0',
        '--output', `type=image,name=${config.registry}/${this.repo}:${this.tag}-${arch},push=true`,
        '--local', `context=${this.buildContext}`,
        '--local', `dockerfile=${dirname(this.file)}`,
        '--opt', `filename=./${basename(this.file)}`,
        '--export-cache', `type=s3,region=${config.cache_bucket_region},bucket=${config.cache_bucket},name=${config.registry}/${this.repo}`,
        '--import-cache', `type=s3,region=${config.cache_bucket_region},bucket=${config.cache_bucket},name=${config.registry}/${this.repo}`,
        '--progress', 'plain',
        ...(this.rest || [])
      ], {
        env: {
          ...process.env,
          BUILDKIT_HOST: `tcp://127.0.0.1:${port}`
        },
        stdio: ['ignore', 'pipe', 'pipe']
      })

      if (arch === 'arm64') {
        this.armBuildProcess = buildProcess
      } else {
        this.amdBuildProcess = buildProcess
      }

      // Prefix output with architecture
      buildProcess.stdout?.on('data', (data) => {
        this.context.logger.writeRaw(`${arch}: ${data}`)
      })

      buildProcess.stderr?.on('data', (data) => {
        this.context.logger.writeRaw(`${arch}: ${data}`)
      })

      buildProcess.on('exit', (code) => {
        resolve(code || 0)
      })
    })
  }

  private cleanup(): void {
    // Kill build processes
    if (this.armBuildProcess && !this.armBuildProcess.killed) {
      this.armBuildProcess.kill('SIGINT')
    }
    if (this.amdBuildProcess && !this.amdBuildProcess.killed) {
      this.amdBuildProcess.kill('SIGINT')
    }

    // Kill tunnel processes
    if (this.armTunnelPid) {
      try {
        process.kill(-this.armTunnelPid, 'SIGTERM')
      } catch {
        // Ignore errors
      }
    }
    if (this.amdTunnelPid) {
      try {
        process.kill(-this.amdTunnelPid, 'SIGTERM')
      } catch {
        // Ignore errors
      }
    }
  }
}