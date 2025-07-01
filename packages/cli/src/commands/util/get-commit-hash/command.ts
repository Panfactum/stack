// This file defines the get-commit-hash command for resolving git references
// It provides a CLI interface to convert branches, tags, and refs to commit SHAs

import { Command, Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getCommitHash } from '@/util/git/getCommitHash';

/**
 * CLI command for resolving git references to commit SHAs
 * 
 * @remarks
 * This command provides a convenient way to resolve various git references
 * (branches, tags, commits) to their full SHA-1 hashes. This is useful for:
 * 
 * - CI/CD pipelines that need stable commit references
 * - Build systems requiring exact version tracking
 * - Deployment scripts that record exact code versions
 * - Git automation that needs to work with commit hashes
 * 
 * The command supports:
 * - Remote branches (e.g., origin/main)
 * - Local branches
 * - Tags (annotated and lightweight)
 * - Short commit hashes
 * - Special reference "local" for current HEAD
 * 
 * @example
 * ```bash
 * # Get current HEAD commit
 * pf util get-commit-hash --ref local
 * 
 * # Get commit for main branch
 * pf util get-commit-hash --ref main
 * 
 * # Get commit for specific tag
 * pf util get-commit-hash --ref v1.2.3
 * 
 * # Get commit from different remote
 * pf util get-commit-hash --repo upstream --ref develop
 * ```
 * 
 * @see {@link getCommitHash} - The underlying utility function
 */
export class GetCommitHashCommand extends PanfactumCommand {
  static override paths = [['util', 'get-commit-hash']];

  static override usage = Command.Usage({
    description: 'Resolve git references to commit SHAs',
    category: 'Utility',
  });

  /** Git repository name (defaults to 'origin' for remote refs) */
  repo = Option.String('-r,--repo', 'origin', {
    description: 'Git repository (defaults to origin/current repo)',
  });

  /** Git reference to resolve (required) */
  ref = Option.String('-c,--ref', {
    description: 'Git reference to resolve (commit, branch, tag, or "local")',
  });

  /** Skip verification of commit existence */
  noVerify = Option.Boolean('-n,--no-verify', false, {
    description: 'Skip verification that commit exists',
  });

  /**
   * Executes the git reference resolution
   * 
   * @remarks
   * Resolves the provided git reference to its full SHA-1 hash and
   * outputs it to stdout. The output contains only the hash with no
   * newline, making it suitable for use in scripts.
   * 
   * @throws {@link CLIError}
   * Throws when the git reference cannot be resolved
   * 
   * @throws {@link CLISubprocessError}
   * Throws when git commands fail
   */
  async execute() {
    const hash = await getCommitHash({
      repo: this.repo,
      ref: this.ref,
      noVerify: this.noVerify,
      context: this.context,
      workingDirectory: process.cwd(),
    });
    this.context.stdout.write(hash);
  }
}