// Records the current timestamp as an annotation on the BuildKit StatefulSet
// Used to track when builds occur for monitoring and scaling purposes

import { Command, Option } from 'clipanion'
import { architectureSchema } from '@/util/buildkit/constants.js'
import { recordBuildKitBuild } from '@/util/buildkit/recordBuild.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { PanfactumZodError } from '@/util/error/error.js'

/**
 * Command for recording build timestamps on BuildKit StatefulSets
 * 
 * @remarks
 * This command annotates BuildKit StatefulSets with the current timestamp
 * to track when builds occur. This tracking information is essential for:
 * 
 * - Monitoring build frequency and patterns
 * - Automatic scaling decisions based on usage
 * - Debugging build distribution across instances
 * - Resource utilization analysis
 * 
 * The timestamp is recorded as a Kubernetes annotation, allowing it to be
 * queried by monitoring systems and scaling controllers.
 * 
 * @example
 * ```bash
 * # Record build on AMD64 BuildKit
 * pf buildkit record-build --arch amd64
 * 
 * # Record build on ARM64 BuildKit
 * pf buildkit record-build --arch arm64
 * 
 * # Use with specific kubectl context
 * pf buildkit record-build --arch amd64 --context staging
 * ```
 * 
 * @see {@link recordBuildKitBuild} - Core timestamp recording logic
 * @see {@link architectureSchema} - Architecture validation schema
 */
export class RecordBuildCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'record-build']]

  static override usage = Command.Usage({
    category: 'BuildKit',
    description: 'Record the current timestamp on the BuildKit StatefulSet',
    details:
      'Annotates the BuildKit StatefulSet with the current timestamp to track when builds occur. ' +
      'This information is used for monitoring build frequency and automatic scaling decisions.',
    examples: [
      ['Record a build on AMD64 BuildKit', '$0 buildkit record-build --arch amd64'],
      ['Record a build on ARM64 BuildKit', '$0 buildkit record-build --arch arm64']
    ]
  })

  arch = Option.String('--arch', {
    required: true,
    description: 'The CPU architecture (amd64 or arm64)'
  })

  kubectlContext = Option.String('--context', {
    description: 'The kubectl context to use for interacting with Kubernetes'
  })

  /**
   * Executes the build timestamp recording command
   * 
   * @remarks
   * Validates the architecture parameter, records the current timestamp
   * as an annotation on the appropriate BuildKit StatefulSet, and outputs
   * a confirmation message.
   * 
   * @returns Exit code (0 for success, 1 for failure)
   * 
   * @throws {@link PanfactumZodError}
   * Throws when the architecture parameter is invalid (not amd64 or arm64)
   * 
   * @throws {@link CLIError}
   * Throws when unable to connect to Kubernetes or update StatefulSet annotations
   */
  async execute(): Promise<number> {
    // Validate and get properly typed architecture
    const parseResult = architectureSchema.safeParse(this.arch);
    if (!parseResult.success) {
      throw new PanfactumZodError('Invalid architecture', 'arch', parseResult.error);
    }
    const validatedArch = parseResult.data;

    await recordBuildKitBuild({
      arch: validatedArch,
      kubectlContext: this.kubectlContext,
      context: this.context
    })

    this.context.stdout.write(`Successfully recorded build timestamp for ${validatedArch} BuildKit\n`)
    return 0
  }
}