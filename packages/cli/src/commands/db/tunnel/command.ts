import { spawn } from 'child_process'
import { select } from '@inquirer/prompts'
import { Option, Command } from 'clipanion'
import { Listr } from 'listr2'
import { PanfactumCommand } from '../../../util/command/panfactumCommand'
import { getTempCredentials } from '../../../util/db/getTempCredentials'
import { getVaultRole } from '../../../util/db/getVaultRole'
import { listDatabases } from '../../../util/db/listDatabases'
import { getOpenPort } from '../../../util/network/getOpenPort'
import { execute } from '../../../util/subprocess/execute'
import { getVaultTokenString } from '../../../util/vault/getToken'
import type { DatabaseType, VaultRole, DatabaseTunnelConfig } from '../../../util/db/types'

export class DbTunnelCommand extends PanfactumCommand {
  static override paths = [['db', 'tunnel']]

  static override usage = Command.Usage({
    description: 'Create a secure tunnel to a database with temporary credentials',
    examples: [
      [
        'Create a tunnel to any database',
        '$0 db tunnel',
      ],
      [
        'Create a tunnel to PostgreSQL databases only',
        '$0 db tunnel --type postgresql',
      ],
      [
        'Create a tunnel to databases in a specific namespace',
        '$0 db tunnel --namespace production',
      ],
    ],
  })

  namespace = Option.String('--namespace', {
    description: 'Filter databases by namespace',
  })

  type = Option.String('--type', {
    description: 'Filter by database type',
  })

  port = Option.String('--port', {
    description: 'Local port to use for tunnel (default: auto-detect)',
  })

  async execute() {
    const { context } = this
    let config: DatabaseTunnelConfig | undefined

    // Validate type if provided
    if (this.type) {
      const validTypes: DatabaseType[] = ['postgresql', 'redis', 'nats']
      if (!validTypes.includes(this.type as DatabaseType)) {
        throw new Error(`Invalid database type. Must be one of: ${validTypes.join(', ')}`)
      }
    }

    const tasks = new Listr([
      {
        title: 'Finding databases',
        task: async () => {
          const databases = await listDatabases(context, this.namespace, this.type as DatabaseType)
          
          if (databases.length === 0) {
            throw new Error('No databases found matching the criteria')
          }

          // Select database
          const dbChoices = databases.map(db => ({
            name: `${db.name} (${db.namespace}) - ${db.type}`,
            value: db,
          }))

          const selectedDb = await select({
            message: 'Select a database',
            choices: dbChoices,
          })

          // Select role for PostgreSQL
          let role: VaultRole = 'reader'
          if (selectedDb.type === 'postgresql') {
            const roleChoices = [
              { name: 'Superuser', value: 'superuser' as VaultRole },
              { name: 'Admin', value: 'admin' as VaultRole },
              { name: 'Reader', value: 'reader' as VaultRole },
            ]

            role = await select({
              message: 'Select database role',
              choices: roleChoices,
            })
          }

          // Get local port
          const localPort = this.port ? parseInt(this.port, 10) : await getOpenPort()

          config = {
            database: selectedDb,
            role,
            localPort,
            credentials: { username: '', password: '' }, // Will be populated later
          }
        },
      },
      {
        title: 'Getting temporary credentials',
        task: async () => {
          if (!config) throw new Error('No database selected')
          
          const vaultRole = getVaultRole(
            config.database.type,
            config.database.namespace,
            config.database.name,
            config.role
          )

          config.credentials = await getTempCredentials(context, vaultRole)
        },
      },
      {
        title: 'Creating tunnel',
        task: async () => {
          if (!config) throw new Error('No configuration')

          const serviceName = config.database.type === 'postgresql'
            ? `${config.database.name}-rw`
            : config.database.name

          context.logger.info(`Creating tunnel on port ${config.localPort}`)

          // Return a promise that will be resolved when the tunnel process exits
          return new Promise<void>((resolve, reject) => {
            const tunnelProcess = spawn('pf-tunnel', [
              serviceName,
              config!.database.port.toString(),
              '--namespace',
              config!.database.namespace,
              '--local-port',
              config!.localPort.toString(),
            ], {
              stdio: 'inherit',
              env: process.env,
            })

            tunnelProcess.on('error', reject)
            tunnelProcess.on('exit', (code) => {
              if (code !== 0 && code !== null) {
                reject(new Error(`Tunnel process exited with code ${code}`))
              } else {
                resolve()
              }
            })

            // Handle cleanup on process termination
            const cleanup = async () => {
              if (config?.credentials.leaseId) {
                try {
                  const vaultToken = await getVaultTokenString({ address: '' })
                  await execute({
                    command: ['vault', 'lease', 'revoke', config.credentials.leaseId],
                    context,
                    workingDirectory: process.cwd(),
                    env: { VAULT_TOKEN: vaultToken },
                  })
                } catch {
                  // Ignore errors during cleanup
                }
              }
              tunnelProcess.kill()
              process.exit(0)
            }

            process.on('SIGINT', cleanup)
            process.on('SIGTERM', cleanup)
          })
        },
      },
    ], { rendererOptions: { collapseErrors: false } })

    await tasks.run()

    // Display connection info
    if (config) {
      context.logger.info('')
      context.logger.info('Database tunnel established!')
      context.logger.info('')
      context.logger.info(`Database: ${config.database.name}`)
      context.logger.info(`Type: ${config.database.type}`)
      context.logger.info(`Namespace: ${config.database.namespace}`)
      context.logger.info(`Local port: ${config.localPort}`)
      context.logger.info('')
      context.logger.info('Connection details:')
      context.logger.info(`  Host: localhost`)
      context.logger.info(`  Port: ${config.localPort}`)
      context.logger.info(`  Username: ${config.credentials.username}`)
      context.logger.info(`  Password: ${config.credentials.password}`)
      context.logger.info('')
      
      if (config.database.type === 'postgresql') {
        context.logger.info(`Connection string: postgresql://${config.credentials.username}:${config.credentials.password}@localhost:${config.localPort}/postgres`)
      } else if (config.database.type === 'redis') {
        context.logger.info(`Connection string: redis://:${config.credentials.password}@localhost:${config.localPort}`)
      }
      
      context.logger.info('')
      context.logger.info('Press Ctrl+C to close the tunnel and revoke credentials')
    }
  }
}