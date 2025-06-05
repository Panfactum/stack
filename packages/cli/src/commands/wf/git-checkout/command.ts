import { Command, Option } from 'clipanion'
import { Listr } from 'listr2'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import { CLIError } from '@/util/error/error'
import { getCommitHash } from '@/util/git/getCommitHash.ts'
import { execute } from '@/util/subprocess/execute.ts'

export class WorkflowGitCheckoutCommand extends PanfactumCommand {
  static override paths = [['wf', 'git-checkout']]

  static override usage = Command.Usage({
    description: 'Efficiently checkout a git repository for CI/CD workflows',
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

  repoUrl = Option.String('-r,--repo', {
    description: 'Repository URL without protocol (e.g., github.com/org/repo)',
    required: true,
  })

  ref = Option.String('-c,--checkout', { 
    description: 'Git reference to checkout (branch, tag, or commit)',
    required: true,
  })
  
  username = Option.String('-u,--username', {
    description: 'Git username for authentication',
  })

  password = Option.String('-p,--password', {
    description: 'Git password or token for authentication',
  })

  directory = Option.String({ required: false })

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
            noVerify: false
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

    context.logger.info('')
    context.logger.success(`✓ Successfully checked out ${this.ref} to ${targetDirectory}`)
    context.logger.info(`✓ Commit SHA: ${commitSha}`)
  }
}