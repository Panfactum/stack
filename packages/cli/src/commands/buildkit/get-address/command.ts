// Gets the address of the least-used BuildKit pod for a specific architecture
// Used by CI/CD pipelines to load balance builds across BuildKit instances

import { Command, Option } from 'clipanion'
import { architectureSchema } from '@/util/buildkit/constants.js'
import { getBuildKitAddress } from '@/util/buildkit/getAddress.js'
import { PanfactumCommand } from '@/util/command/panfactumCommand.js'
import { PanfactumZodError } from '@/util/error/error.js'

/**
 * Command for retrieving BuildKit pod addresses with load balancing
 * 
 * @remarks
 * This command finds and returns the address of the least-used BuildKit pod
 * for a specific CPU architecture. It helps distribute build workloads across
 * multiple BuildKit instances by selecting pods with the lowest CPU usage.
 * 
 * The command supports both AMD64 and ARM64 architectures and can return
 * addresses with or without the TCP protocol prefix for different use cases.
 * 
 * Key features:
 * - Load balancing across BuildKit instances
 * - Architecture-specific pod selection
 * - Optional protocol prefix omission
 * - Kubernetes context customization
 * 
 * @example
 * ```bash
 * # Get AMD64 BuildKit address
 * pf buildkit get-address --arch amd64
 * 
 * # Get ARM64 address without protocol prefix
 * pf buildkit get-address --arch arm64 --omit-protocol
 * 
 * # Use with specific kubectl context
 * pf buildkit get-address --arch amd64 --context production
 * ```
 * 
 * @see {@link getBuildKitAddress} - Core address retrieval logic
 * @see {@link architectureSchema} - Architecture validation schema
 */
export class GetAddressCommand extends PanfactumCommand {
  static override paths = [['buildkit', 'get-address']]

  static override usage = Command.Usage({
    category: 'BuildKit',
    description: 'Get the address of the least-used BuildKit pod for a specific architecture',
    details:
      'Returns the address of a BuildKit pod that has the lowest CPU usage for the specified architecture. ' +
      'This helps distribute build load across multiple BuildKit instances.',
    examples: [
      ['Get AMD64 BuildKit address', '$0 buildkit get-address --arch amd64'],
      ['Get ARM64 BuildKit address without protocol', '$0 buildkit get-address --arch arm64 --omit-protocol']
    ]
  })

  arch = Option.String('--arch', {
    required: true,
    description: 'The CPU architecture (amd64 or arm64)'
  })

  omitProtocol = Option.Boolean('--omit-protocol', {
    description: 'Omit the tcp:// protocol prefix from the address'
  })

  kubectlContext = Option.String('--context', {
    description: 'The kubectl context to use for interacting with Kubernetes'
  })

  /**
   * Executes the BuildKit address retrieval command
   * 
   * @remarks
   * Validates the architecture parameter, retrieves the least-used BuildKit
   * pod address, and outputs it to stdout. The command performs load balancing
   * by selecting pods with the lowest CPU usage.
   * 
   * @returns Exit code (0 for success, 1 for failure)
   * 
   * @throws {@link PanfactumZodError}
   * Throws when the architecture parameter is invalid (not amd64 or arm64)
   * 
   * @throws {@link CLIError}
   * Throws when unable to connect to Kubernetes or retrieve BuildKit addresses
   */
  async execute(): Promise<number> {
    // Validate and get properly typed architecture
    const parseResult = architectureSchema.safeParse(this.arch);
    if (!parseResult.success) {
      throw new PanfactumZodError('Invalid architecture', 'arch', parseResult.error);
    }
    const validatedArch = parseResult.data;

    const address = await getBuildKitAddress({
      arch: validatedArch,
      kubectlContext: this.kubectlContext,
      omitProtocol: this.omitProtocol,
      context: this.context
    })

    this.context.stdout.write(address + '\n')
    return 0
  }
}