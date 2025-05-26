import { promises as fs } from 'fs'
import { join } from 'path'
import { Command, Option } from 'clipanion'
import { Listr } from 'listr2'
import { PanfactumCommand } from '../../../util/command/panfactumCommand'
import { execute } from '../../../util/subprocess/execute'

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

  ref = Command.String({ required: true })
  directory = Command.String({ required: true })
  
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
        title: 'Configuring git authentication',
        enabled: () => !!(this.username && this.password),
        task: async () => {
          // Configure git to use provided credentials
          const gitConfigCommands = [
            ['git', 'config', '--global', 'credential.helper', `store --file=${join(this.directory, '.git-credentials')}`],
            ['git', 'config', '--global', 'user.name', this.username || 'Panfactum Workflow'],
            ['git', 'config', '--global', 'user.email', `${this.username || 'workflow'}@panfactum.local`],
          ]

          for (const cmd of gitConfigCommands) {
            await execute({
              command: cmd,
              context,
              workingDirectory: this.directory,
            })
          }

          // Store credentials if provided
          if (this.username && this.password) {
            const credentialsContent = `https://${this.username}:${this.password}@github.com\n`
            await fs.writeFile(
              join(this.directory, '.git-credentials'),
              credentialsContent,
              { mode: 0o600 }
            )
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
          const cloneCmd = ['git', 'clone', '--depth=1', '--branch', this.ref, repoUrl, this.directory]
          
          try {
            await execute({
              command: cloneCmd,
              context,
              workingDirectory: process.cwd(),
            })
          } catch (error) {
            // If branch doesn't exist, try as a tag or commit
            if (error instanceof Error && (error.message.includes('Remote branch') || error.message.includes('not found'))) {
              // Clone default branch first
              const defaultCloneCmd = ['git', 'clone', '--depth=1', repoUrl, this.directory]
              await execute({
                command: defaultCloneCmd,
                context,
                workingDirectory: process.cwd(),
              })
              
              // Then fetch the specific ref
              await execute({
                command: ['git', 'fetch', '--depth=1', 'origin', this.ref],
                context,
                workingDirectory: this.directory,
              })
              
              await execute({
                command: ['git', 'checkout', this.ref],
                context,
                workingDirectory: this.directory,
              })
            } else {
              throw error
            }
          }
        },
      },
      {
        title: 'Resolving git reference',
        task: async () => {
          const { stdout } = await execute({
            command: ['git', 'rev-parse', 'HEAD'],
            context,
            workingDirectory: this.directory,
          })
          commitSha = stdout.trim()
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
        },
      },
    ], { rendererOptions: { collapseErrors: false } })

    await tasks.run()

    context.logger.info('')
    context.logger.success(`✓ Successfully checked out ${this.ref} to ${this.directory}`)
    context.logger.info(`✓ Commit SHA: ${commitSha || 'unknown'}`)
  }
}