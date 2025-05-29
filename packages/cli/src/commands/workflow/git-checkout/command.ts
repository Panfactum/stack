import { promises as fs } from 'fs'
import { join } from 'path'
import { Command, Option } from 'clipanion'
import { Listr } from 'listr2'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import { getCommitHash } from '@/util/git/getCommitHash.ts'
import { execute } from '@/util/subprocess/execute.ts'

export class WorkflowGitCheckoutCommand extends PanfactumCommand {
  static override paths = [['workflow', 'git-checkout']]

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
        'Checkout a specific branch',
        '$0 workflow git-checkout main /workspace/repo',
      ],
      [
        'Checkout with authentication',
        '$0 workflow git-checkout v1.2.3 /workspace/repo --username git --password token123',
      ],
    ],
  })

  ref = Option.String({ required: true })
  directory = Option.String({ required: true })
  
  username = Option.String('--username', {
    description: 'Git username for authentication',
  })

  password = Option.String('--password', {
    description: 'Git password or token for authentication',
  })

  async execute() {
    const { context } = this
    let repoUrl = ''
    let commitSha = ''
    
    const tasks = new Listr([
      {
        title: 'Preparing checkout directory',
        task: async () => {
          // Create directory if it doesn't exist
          await fs.mkdir(this.directory, { recursive: true })
          
          // Clean directory if it exists and is not empty
          const files = await fs.readdir(this.directory)
          if (files.length > 0) {
            await execute({
              command: ['rm', '-rf', `${this.directory}/*`],
              context,
              workingDirectory: process.cwd(),
            })
          }
        },
      },
      {
        title: 'Configuring git user',
        task: async () => {
          // Configure git user for commits
          const gitConfigCommands = [
            ['git', 'config', '--global', 'user.name', this.username || 'Panfactum Workflow'],
            ['git', 'config', '--global', 'user.email', `${this.username || 'workflow'}@panfactum.local`],
          ]

          for (const cmd of gitConfigCommands) {
            await execute({
              command: cmd,
              context,
              workingDirectory: process.cwd(),
            })
          }
        },
      },
      {
        title: 'Detecting repository URL',
        task: async () => {
          // Try to get the origin URL from current repo if we're in one
          try {
            const { stdout } = await execute({
              command: ['git', 'config', '--get', 'remote.origin.url'],
              context,
              workingDirectory: process.cwd(),
            })
            repoUrl = stdout.trim()
          } catch {
            throw new Error('Could not detect repository URL. Please run from within a git repository.')
          }
        },
      },
      {
        title: 'Performing shallow clone',
        task: async () => {
          // Build clone URL with authentication if provided
          let cloneUrl = repoUrl
          if (this.username && this.password) {
            // Extract protocol and rest of URL
            const urlMatch = repoUrl.match(/^(https?:\/\/)(.+)$/)
            if (urlMatch) {
              cloneUrl = `${urlMatch[1]}${this.username}:${this.password}@${urlMatch[2]}`
            }
          }
          
          const cloneCmd = ['git', 'clone', '-q', '--depth=1', cloneUrl, this.directory]
          
          await execute({
            command: cloneCmd,
            context,
            workingDirectory: process.cwd(),
          })
        },
      },
      {
        title: 'Resolving and checking out reference',
        task: async () => {
          // Resolve the ref to a commit SHA using the utility function
          // This matches the bash script's use of pf-get-commit-hash
          commitSha = await getCommitHash({
            repo: repoUrl,
            ref: this.ref,
            noVerify: true  // Don't verify locally since we haven't fetched yet
          })
          
          // Fetch the specific commit
          await execute({
            command: ['git', 'fetch', 'origin', commitSha],
            context,
            workingDirectory: this.directory,
          })
          
          // Checkout the commit
          await execute({
            command: ['git', 'checkout', commitSha],
            context,
            workingDirectory: this.directory,
          })
        },
      },
      {
        title: 'Initializing Git LFS',
        task: async () => {
          try {
            // Check if Git LFS is used in this repository
            await fs.access(join(this.directory, '.gitattributes'))
            
            // Initialize Git LFS
            await execute({
              command: ['git', 'lfs', 'install'],
              context,
              workingDirectory: this.directory,
            })
            
            // Pull LFS files
            await execute({
              command: ['git', 'lfs', 'pull'],
              context,
              workingDirectory: this.directory,
            })
          } catch {
            // No Git LFS or .gitattributes file, skip
          }
        },
      },
      {
        title: 'Configuring repository',
        task: async () => {
          // Set safe directory to avoid git ownership issues in containers
          await execute({
            command: ['git', 'config', '--global', '--add', 'safe.directory', this.directory],
            context,
            workingDirectory: this.directory,
          })
          
          // Configure git for the repository
          const configCommands = [
            ['git', 'config', 'core.fileMode', 'false'],
            ['git', 'config', 'core.autocrlf', 'false'],
          ]
          
          for (const cmd of configCommands) {
            await execute({
              command: cmd,
              context,
              workingDirectory: this.directory,
            })
          }
          
          // Configure URL rewriting for authentication if credentials provided
          if (this.username && this.password && repoUrl) {
            // Extract the base repo URL without protocol
            const repoWithoutProtocol = repoUrl.replace(/^https?:\/\//, '')
            
            await execute({
              command: [
                'git', 
                'config', 
                `url.https://${this.username}:${this.password}@${repoWithoutProtocol}.insteadOf`,
                `https://${repoWithoutProtocol}`
              ],
              context,
              workingDirectory: this.directory,
            })
          }
        },
      },
    ], { rendererOptions: { collapseErrors: false } })

    await tasks.run()

    context.logger.info('')
    context.logger.success(`✓ Successfully checked out ${this.ref} to ${this.directory}`)
    context.logger.info(`✓ Commit SHA: ${commitSha || 'unknown'}`)
  }
}