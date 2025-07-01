// This file defines the util get-module-hash command for computing module checksums
// It generates deterministic hashes for Terraform/Terragrunt module contents

import { Command, Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getModuleHash } from '@/util/terragrunt/getModuleHash';

/**
 * CLI command for generating deterministic hashes of Terraform modules
 * 
 * @remarks
 * This command computes a SHA1 hash of a Terraform/Terragrunt module's
 * contents, providing a unique identifier for the module state. It's
 * essential for change detection and module versioning.
 * 
 * The hash calculation includes:
 * - All .tf and .hcl files in the module
 * - Module dependencies and sources
 * - Variable definitions and defaults
 * - Excluded: .terraform directories, state files, logs
 * 
 * Common use cases:
 * - Change detection in CI/CD pipelines
 * - Module version tracking
 * - Cache invalidation strategies
 * - Deployment drift detection
 * - Module integrity verification
 * 
 * The hash is deterministic - identical module contents
 * always produce the same hash, regardless of timestamps
 * or file ordering.
 * 
 * @example
 * ```bash
 * # Get hash of current directory module
 * pf util get-module-hash
 * 
 * # Get hash of specific module
 * pf util get-module-hash /path/to/module
 * 
 * # Use in scripts for change detection
 * BEFORE=$(pf util get-module-hash)
 * # Make changes...
 * AFTER=$(pf util get-module-hash)
 * if [ "$BEFORE" != "$AFTER" ]; then
 *   echo "Module has changed"
 * fi
 * 
 * # Store hash for version tracking
 * pf util get-module-hash > .module-version
 * ```
 * 
 * @see {@link getModuleHash} - Core hash computation logic
 */
export class GetModuleHashCommand extends PanfactumCommand {
  static override paths = [['util', 'get-module-hash']];

  static override usage = Command.Usage({
    description: 'Generate SHA1 hash of Terraform module contents',
    category: 'Utility',
  });

  /**
   * Path to the Terraform/Terragrunt module
   * 
   * @remarks
   * Defaults to current directory if not specified.
   * Must be a valid module directory containing .tf or .hcl files.
   */
  modulePath = Option.String({ required: false });

  /**
   * Executes the module hash generation
   * 
   * @remarks
   * Computes a deterministic SHA1 hash of the module contents
   * and outputs it to stdout without trailing newline. Returns
   * silently if no hash can be computed (e.g., invalid path).
   * 
   * The hash includes:
   * - Terraform configuration files (.tf)
   * - Terragrunt configuration files (.hcl)
   * - Module structure and dependencies
   * 
   * @returns Exit code (always 0)
   */
  async execute(): Promise<number> {
    const hash = await getModuleHash(this.modulePath || '');
    if (hash) {
      this.context.stdout.write(hash);
    }
    return 0;
  }
}