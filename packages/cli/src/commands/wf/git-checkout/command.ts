// This file defines the wf git-checkout command for CI/CD repository operations
// It provides optimized git checkout functionality for workflow environments

import { Command, Option } from 'clipanion'
import { Listr } from 'listr2'
import { PanfactumLightCommand } from '@/util/command/panfactumCommand.ts'
import { CLIError, CLISubprocessError } from '@/util/error/error'
import { getCommitHash } from '@/util/git/getCommitHash.ts'

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
 * - Optional sparse checkout (`--sparse`) to materialize only one subdirectory,
 *   combined with `--filter=blob:none` to skip downloading unreferenced blobs
 * - Optional LFS skip (`--no-lfs`) for repositories with no binary assets
 * - Credential persistence for subsequent operations
 * - Protection bypass for container environments
 *
 * The command workflow:
 * 1. Shallow clone the repository (with optional blob filter + sparse flag)
 * 2. Configure sparse checkout path (if --sparse is set)
 * 3. Configure authentication for future operations
 * 4. Resolve git reference to exact commit SHA
 * 5. Fetch and checkout the specific commit (with optional blob filter)
 * 6. Initialize Git LFS and pull large files (skipped when --no-lfs)
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
export class WorkflowGitCheckoutCommand extends PanfactumLightCommand {
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

      Pass --sparse <path> to enable sparse checkout: only blobs under the
      given subdirectory are downloaded, significantly reducing network usage
      when you only need one directory from a large monorepo.

      Pass --no-lfs to skip Git LFS initialization and pull, which is safe
      whenever the target path contains no LFS-tracked files.
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
   * Subdirectory path to limit materialized files to via sparse checkout
   *
   * @remarks
   * When set, clones with `--filter=blob:none --sparse` and runs
   * `git sparse-checkout set <path>` so only blobs under the given
   * subdirectory are downloaded. The fetch step also passes
   * `--filter=blob:none` to avoid downloading unreferenced blobs.
   *
   * Use this when you only need one directory from a large monorepo.
   */
  sparsePath = Option.String('--sparse', {
    description: 'Enable sparse checkout: only materialize files under this subdirectory',
  })

  /**
   * Whether to skip Git LFS initialization and pull
   *
   * @remarks
   * Set this when the target path contains no LFS-tracked files.
   * Skipping LFS saves the overhead of `git lfs install` and `git lfs pull`.
   */
  skipLfs = Option.Boolean('--no-lfs', false, {
    description: 'Skip Git LFS initialization and pull',
  })

  /**
   * Executes the optimized git checkout workflow
   *
   * @remarks
   * Performs a series of git operations optimized for CI/CD:
   * - Validates authentication parameters
   * - Clones with minimal history (optionally with blob filter + sparse flag)
   * - Configures sparse checkout path when `--sparse` is set
   * - Configures credentials for future operations
   * - Resolves references to commit SHAs
   * - Checks out exact commit (fetch uses blob filter when `--sparse` is set)
   * - Initializes Git LFS support (skipped when `--no-lfs` is set)
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

          if (this.username && this.password) {
            cloneUrl = `https://${this.username}:${this.password}@${this.repoUrl}`
          }

          // When a sparse path is requested, skip downloading all blobs up front.
          // git sparse-checkout set (next task) will pull only the blobs we need.
          const cloneCmd = this.sparsePath
            ? ['git', 'clone', '-q', '--depth=1', '--filter=blob:none', '--sparse', cloneUrl, targetDirectory]
            : ['git', 'clone', '-q', '--depth=1', cloneUrl, targetDirectory]

          const cloneResult = await context.subprocessManager.execute({
            env,
            command: cloneCmd,
            workingDirectory: process.cwd(),
          }).exited

          if (cloneResult.exitCode !== 0) {
            throw new CLISubprocessError(
              `Failed to clone repository ${this.repoUrl}`,
              {
                // Rewrite the command to avoid leaking credentials in error output
                command: (this.sparsePath
                  ? ['git', 'clone', '-q', '--depth=1', '--filter=blob:none', '--sparse', `https://${this.repoUrl}`, targetDirectory]
                  : ['git', 'clone', '-q', '--depth=1', `https://${this.repoUrl}`, targetDirectory]
                ).join(' '),
                subprocessLogs: cloneResult.output,
                workingDirectory: process.cwd(),
              }
            )
          }
        },
      },
      {
        title: 'Configuring sparse checkout',
        skip: () => !this.sparsePath,
        task: async () => {
          const sparseSetCmd = ['git', 'sparse-checkout', 'set', this.sparsePath!]
          const sparseResult = await context.subprocessManager.execute({
            env,
            command: sparseSetCmd,
            workingDirectory: targetDirectory,
          }).exited

          if (sparseResult.exitCode !== 0) {
            throw new CLISubprocessError(
              `Failed to configure sparse checkout for path '${this.sparsePath}'`,
              {
                command: sparseSetCmd.join(' '),
                subprocessLogs: sparseResult.output,
                workingDirectory: targetDirectory,
              }
            )
          }
        },
      },
      {
        title: 'Configuring authentication',
        task: async () => {
          // Persist the username/password authentication locally in the repository
          // This enables future git operations to not need explicit credentials
          if (this.username && this.password) {
            const configCommand = [
              'git',
              'config',
              `url.https://${this.username}:${this.password}@${this.repoUrl}.insteadOf`,
              `https://${this.repoUrl}`
            ]
            const configResult = await context.subprocessManager.execute({
              env,
              command: configCommand,
              workingDirectory: targetDirectory,
            }).exited

            if (configResult.exitCode !== 0) {
              throw new CLISubprocessError(
                'Failed to configure git authentication',
                {
                  // Avoid leaking credentials in error output
                  command: ['git', 'config', `url.https://***@${this.repoUrl}.insteadOf`, `https://${this.repoUrl}`].join(' '),
                  subprocessLogs: configResult.output,
                  workingDirectory: targetDirectory,
                }
              )
            }
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
            noVerify: true,
            context: context,
            workingDirectory: targetDirectory,
          })
        },
      },
      {
        title: 'Checking out commit',
        task: async () => {
          // Fetch the specific commit; when sparse checkout is active, pass
          // --filter=blob:none so only blobs under the sparse path are fetched.
          const fetchCommand = this.sparsePath
            ? ['git', 'fetch', '--filter=blob:none', 'origin', commitSha]
            : ['git', 'fetch', 'origin', commitSha]
          const fetchResult = await context.subprocessManager.execute({
            env,
            command: fetchCommand,
            workingDirectory: targetDirectory,
          }).exited

          if (fetchResult.exitCode !== 0) {
            throw new CLISubprocessError(
              `Failed to fetch commit ${commitSha}`,
              {
                command: fetchCommand.join(' '),
                subprocessLogs: fetchResult.output,
                workingDirectory: targetDirectory,
              }
            )
          }

          // Checkout the commit
          const checkoutCommand = ['git', 'checkout', commitSha]
          const checkoutResult = await context.subprocessManager.execute({
            env,
            command: checkoutCommand,
            workingDirectory: targetDirectory,
          }).exited

          if (checkoutResult.exitCode !== 0) {
            throw new CLISubprocessError(
              `Failed to checkout commit ${commitSha}`,
              {
                command: checkoutCommand.join(' '),
                subprocessLogs: checkoutResult.output,
                workingDirectory: targetDirectory,
              }
            )
          }
        },
      },
      {
        title: 'Initializing Git LFS',
        skip: () => this.skipLfs,
        task: async () => {
          // Initialize Git LFS locally
          const lfsInstallCommand = ['git', 'lfs', 'install', '--local']
          const lfsInstallResult = await context.subprocessManager.execute({
            env,
            command: lfsInstallCommand,
            workingDirectory: targetDirectory,
          }).exited

          if (lfsInstallResult.exitCode !== 0) {
            throw new CLISubprocessError(
              'Failed to initialize Git LFS',
              {
                command: lfsInstallCommand.join(' '),
                subprocessLogs: lfsInstallResult.output,
                workingDirectory: targetDirectory,
              }
            )
          }

          // Pull LFS files
          const lfsPullCommand = ['git', 'lfs', 'pull']
          const lfsPullResult = await context.subprocessManager.execute({
            env,
            command: lfsPullCommand,
            workingDirectory: targetDirectory,
          }).exited

          if (lfsPullResult.exitCode !== 0) {
            throw new CLISubprocessError(
              'Failed to pull Git LFS files',
              {
                command: lfsPullCommand.join(' '),
                subprocessLogs: lfsPullResult.output,
                workingDirectory: targetDirectory,
              }
            )
          }
        },
      },
    ], { rendererOptions: { collapseErrors: false } })

    await tasks.run()

    context.logger.success(`✓ Successfully checked out ${this.ref} to ${targetDirectory} (commit: ${commitSha})`)
  }
}