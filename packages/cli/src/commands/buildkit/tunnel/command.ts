import { Option } from 'clipanion'
import { z } from 'zod'
import { getBuildKitConfig } from '@/util/buildkit/config.js'
import { architectureSchema } from '@/util/buildkit/constants.js'
import { getBuildKitAddress } from '@/util/buildkit/getAddress.js'
import { scaleUpBuildKit } from '@/util/buildkit/scaleUp.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { CLUSTERS_FILE_SCHEMA } from '@/util/devshell/updateKubeConfig.js'
import { execute } from '@/util/subprocess/execute.js'
import { readYAMLFile } from '@/util/yaml/readYAMLFile.js'

// Zod schema for port validation
const portSchema = z.string()
  .regex(/^\d+$/, 'Port must be a number')
  .transform(Number)
  .refine((port) => port >= 1 && port <= 65535, {
    message: 'Port must be between 1 and 65535'
  })

export default class BuildkitTunnelCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'tunnel']]

  static override usage = PanfactumCommand.Usage({
    description: 'Sets up a network tunnel from the local host to a remote BuildKit server'
  })

  arch = Option.String('--arch', {
    required: true,
    description: 'The CPU architecture of the BuildKit instance to connect with (amd64 or arm64)'
  })

  port = Option.String('--port', {
    required: true,
    description: 'The local port to bind the tunnel to'
  })

  async execute(): Promise<number> {
    // Validate and get properly typed architecture
    const validatedArch = architectureSchema.parse(this.arch)

    // Validate port
    const portNum = portSchema.parse(this.port)

    // Get BuildKit configuration
    const config = await getBuildKitConfig(this.context)

    // Validate context exists
    const clustersData = await readYAMLFile({
      context: this.context,
      filePath: `${this.context.repoVariables.kube_dir}/clusters.yaml`,
      validationSchema: CLUSTERS_FILE_SCHEMA,
      throwOnMissing: false,
      throwOnEmpty: false
    })

    if (!clustersData || !clustersData[config.cluster]) {
      this.context.logger.error(`'${config.cluster}' not found in clusters.yaml. Run pf devshell sync to regenerate kubeconfig.`)
      return 1
    }

    // Scale up the BuildKit instance
    await scaleUpBuildKit({
      context: this.context,
      architectures: [validatedArch],
      kubectlContext: config.cluster,
      wait: true
    })

    // Get the address of a free instance
    const address = await getBuildKitAddress({
      arch: validatedArch,
      kubectlContext: config.cluster,
      omitProtocol: true,
      context: this.context
    })

    // Run the tunnel
    await execute({
      command: [
        'pf',
        'tunnel',
        config.bastion,
        address,
        '--local-port',
        portNum.toString()
      ],
      context: this.context,
      workingDirectory: process.cwd()
    })

    return 0
  }
}