// This file defines the wf git-checkout command for CI/CD repository operations
// It provides optimized git checkout functionality for workflow environments

import { Command, Option } from 'clipanion'
import { Listr } from 'listr2'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import { CLIError } from '@/util/error/error'
import { getCommitHash } from '@/util/git/getCommitHash.ts'
import { execute } from '@/util/subprocess/execute.ts'

/**
 * CLI command for efficient git repository checkout in CI/CD workflows
 * 
 * @remarks
 * This command provides an optimized git checkout process specifically
 * designed for CI/CD environments. It prioritizes speed and reliability
 * while handling authentication and large file support.
 * 
 * Key optimizations:
 * - Shallow cloning (depth=1) for minimal data transfer
 * - Direct commit checkout to avoid branch synchronization
 * - Automatic Git LFS support for binary assets
 * - Credential persistence for subsequent operations
 * - Protection bypass for container environments
 * 
 * The command workflow:
 * 1. Shallow clone the repository
 * 2. Configure authentication for future operations
 * 3. Resolve git reference to exact commit SHA
 * 4. Fetch and checkout the specific commit
 * 5. Initialize Git LFS and pull large files
 * 
 * Security features:
 * - Supports token-based authentication
 * - Credentials stored only in local git config
 * - No credentials logged or exposed
 * - Compatible with GitHub, GitLab, Bitbucket
 * 
 * This command is typically used by:
 * - Panfactum workflow containers
 * - CI/CD pipeline steps
 * - Automated deployment processes
 * - Build environments
 * 
 * @example
 * ```bash
 * # Checkout public repository
 * pf wf git-checkout --repo github.com/panfactum/stack --checkout main
 * 
 * # Checkout with GitHub token
 * pf wf git-checkout \
 *   --repo github.com/org/private-repo \
 *   --checkout v1.2.3 \
 *   --username git \
 *   --password $GITHUB_TOKEN
 * 
 * # Checkout to custom directory
 * pf wf git-checkout \
 *   --repo gitlab.com/team/project \
 *   --checkout feature/new-feature \
 *   source-code
 * ```
 * 
 * @see {@link getCommitHash} - For reference resolution
 * @see {@link execute} - For git command execution
 */
export class WorkflowGitCheckoutCommand extends PanfactumCommand {
  static override paths = [['wf', 'git-checkout']]

  static override usage = Command.Usage({
    description: 'Efficiently checkout a git repository in CI/CD workflows',
    category: 'Workflow',
    details: `
      This command performs an optimized git checkout suitable for CI/CD workflows:
      - Shallow clone (depth=1) for speed
      - Supports authentication with username/password
      - Resolves references to commit SHAs
      - Configures git for future operations
      - Initializes Git LFS if needed
      
      Designed for use in isolated container environments.
    `,
    examples: [
      [
        'Checkout a public repository',
        '$0 wf git-checkout --repo github.com/panfactum/stack --checkout main',
      ],
      [
        'Checkout with authentication',
        '$0 wf git-checkout --repo github.com/org/private-repo --checkout v1.2.3 --username git --password token123',
      ],
    ],
  })

  /**
   * Repository URL without protocol scheme
   * 
   * @remarks
   * Format: domain/org/repo (e.g., github.com/org/repo)
   * Protocol (https://) is added automatically.
   */
  repoUrl = Option.String('-r,--repo', {
    description: 'Repository URL without protocol (e.g., github.com/org/repo)',
    required: true,
  })

  /**
   * Git reference to checkout
   * 
   * @remarks
   * Supports branches, tags, or commit SHAs.
   * Will be resolved to exact commit SHA for reliability.
   */
  ref = Option.String('-c,--checkout', { 
    description: 'Git reference to checkout (branch, tag, or commit)',
    required: true,
  })
  
  /**
   * Git username for authentication
   * 
   * @remarks
   * Typically 'git' for token-based auth.
   * Required when accessing private repositories.
   */
  username = Option.String('-u,--username', {
    description: 'Git username for authentication',
  })

  /**
   * Git password or access token
   * 
   * @remarks
   * Use personal access tokens or CI tokens.
   * Required when username is provided.
   */
  password = Option.String('-p,--password', {
    description: 'Git password or token for authentication',
  })

  /**
   * Target directory for checkout
   * 
   * @remarks
   * Defaults to 'repo' if not specified.
   * Directory will be created if it doesn't exist.
   */
  directory = Option.String({ required: false })

  /**
   * Executes the optimized git checkout workflow
   * 
   * @remarks
   * Performs a series of git operations optimized for CI/CD:
   * - Validates authentication parameters
   * - Clones with minimal history
   * - Configures credentials for future operations
   * - Resolves references to commit SHAs
   * - Checks out exact commit
   * - Initializes Git LFS support
   * 
   * The process is displayed with progress indicators
   * and detailed error reporting on failures.
   * 
   * @throws {@link CLIError}
   * Throws when username provided without password
   * 
   * @throws {@link CLISubprocessError}
   * Throws when git operations fail
   */
  async execute() {
    const { context } = this
    let commitSha = ''
    
    // Validate that password is provided if username is provided
    if (this.username && !this.password) {
      throw new CLIError('If --username is supplied, a --password must also be supplied.')
    }
    
    // Set default directory to 'repo' if not provided
    const targetDirectory = this.directory || 'repo'
    
    const env = {
      ...context.env,
      GIT_CLONE_PROTECTION_ACTIVE: 'false', // Disable git clone protection for container environments
    }
    
    const tasks = new Listr([
      {
        title: 'Cloning repository',
        task: async () => {
          // Build clone URL with authentication if provided
          let cloneUrl = `https://${this.repoUrl}`
          if (this.username && !this.password) {
            throw new Error('If --username is supplied, a --password must also be supplied.')
          }
          
          if (this.username && this.password) {
            cloneUrl = `https://${this.username}:${this.password}@${this.repoUrl}`
          }
          
          const cloneCmd = ['git', 'clone', '-q', '--depth=1', cloneUrl, targetDirectory]
          
          await execute({
            context,
            env,
            command: cloneCmd,
            workingDirectory: process.cwd(),
          })
        },
      },
      {
        title: 'Configuring authentication',
        task: async () => {
          // Persist the username/password authentication locally in the repository
          // This enables future git operations to not need explicit credentials
          if (this.username && this.password) {
            await execute({
              env,
              context,
              command: [
                'git', 
                'config', 
                `url.https://${this.username}:${this.password}@${this.repoUrl}.insteadOf`,
                `https://${this.repoUrl}`
              ],
              workingDirectory: targetDirectory,
            })
          }
        },
      },
      {
        title: 'Resolving git reference',
        task: async () => {
          // Resolve the ref to a commit SHA using the utility function
          // This matches the bash script's use of pf-get-commit-hash
          commitSha = await getCommitHash({
            repo: `https://${this.repoUrl}`,
            ref: this.ref,
            noVerify: false,
            context: context,
            workingDirectory: process.cwd(),
          })
        },
      },
      {
        title: 'Checking out commit',
        task: async () => {
          // Fetch the specific commit
          await execute({
            env,
            context,
            command: ['git', 'fetch', 'origin', commitSha],
            workingDirectory: targetDirectory,
          })
          
          // Checkout the commit
          await execute({
            env,
            context,
            command: ['git', 'checkout', commitSha],
            workingDirectory: targetDirectory,
          })
        },
      },
      {
        title: 'Initializing Git LFS',
        task: async () => {
          // Initialize Git LFS locally
          await execute({
            env,
            context,
            command: ['git', 'lfs', 'install', '--local'],
            workingDirectory: targetDirectory,
          })
          
          // Pull LFS files
          await execute({
            env,
            context,
            command: ['git', 'lfs', 'pull'],
            workingDirectory: targetDirectory,
          })
        },
      },
    ], { rendererOptions: { collapseErrors: false } })

    await tasks.run()

    context.logger.success(`✓ Successfully checked out ${this.ref} to ${targetDirectory} (commit: ${commitSha})`)
  }
}