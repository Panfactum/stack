import { Option, Command } from 'clipanion'
import { z } from 'zod'
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import {getAllRegions} from "@/util/config/getAllRegions.ts";
import {getPanfactumConfig} from "@/util/config/getPanfactumConfig.ts";
import { getTempCredentials } from '@/util/db/getTempCredentials.ts'
import { getVaultRole } from '@/util/db/getVaultRole.ts'
import { listDatabases } from '@/util/db/listDatabases.ts'
import { databaseTypeSchema, vaultRoleSchema, type DatabaseType } from '@/util/db/types.ts'
import { CLIError, PanfactumZodError } from '@/util/error/error'
import { getOpenPort } from '@/util/network/getOpenPort.ts'
import { execute } from '@/util/subprocess/execute.ts'
import { createSSHTunnel } from '@/util/tunnel/createSSHTunnel.js'
import { getVaultToken } from '@/util/vault/getVaultToken'

// Zod schema for port validation
const portSchema = z.string()
  .regex(/^\d+$/, 'Port must be a number')
  .transform(Number)
  .refine((port) => port >= 1 && port <= 65535, {
    message: 'Port must be between 1 and 65535'
  })

export class DbTunnelCommand extends PanfactumCommand {
  static override paths = [['db', 'tunnel']]

  static override usage = Command.Usage({
    description: 'Create a secure tunnel to a database with temporary credentials',
    category: 'Database',
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

  type = Option.String('--type', {
    description: 'Filter by database type',
  })

  port = Option.String('--port', {
    description: 'Local port to use for tunnel (default: auto-detect)',
  })

  async execute(): Promise<number | void> {
    const { context } = this

    // Validate type if provided and get properly typed value
    let validatedType: DatabaseType | undefined
    if (this.type) {
      const typeResult = databaseTypeSchema.safeParse(this.type)
      if (!typeResult.success) {
        throw new PanfactumZodError('Invalid database type', 'type', typeResult.error)
      }
      validatedType = typeResult.data
    }

    // Validate port if provided (fail fast)
    let validatedPort: number | undefined
    if (this.port) {
      const portResult = portSchema.safeParse(this.port)
      if (!portResult.success) {
        throw new PanfactumZodError('Invalid port', 'port', portResult.error)
      }
      validatedPort = portResult.data
    }

    const regions = (await getAllRegions(this.context)).filter(region => region.bastionDeployed)

    if (regions.length === 0) {
      throw new CLIError([
        `No available regions found with kube_bastion deployed.`,
      ]);
    }

    const selectedRegion = await this.context.logger.select({
      message: "Select the region for the cluster:",
      choices: regions.map(region => ({
        value: region,
        name: `${region.name}`
      })),
    });

    /*******************************************
     * Config Loading + Checks
     *
     * Loads the configuration necessary for the installation process
     *******************************************/
    const config = await getPanfactumConfig({
      context: this.context,
      directory: selectedRegion.path,
    });

    if (!config.aws_profile) {
      throw new CLIError('AWS profile is not configured. Please set aws_profile in your environment.yaml.')
    }

    if (!config.kube_config_context) {
      throw new CLIError('Kubernetes context is not configured. Please set kube_config_context in your region.yaml.')
    }

    if (!config.vault_addr) {
      throw new CLIError(`vault_addr configuration is missing for the selected region ${selectedRegion.name}.`)
    }

    // Step 1: Find databases
    context.logger.info('Finding databases...')
    const databases = await listDatabases(context, validatedType)
    
    if (databases.length === 0) {
      throw new CLIError('No databases found matching the criteria')
    }

    // Select database
    const dbChoices = databases.map(db => ({
      name: `${db.name} (${db.namespace}) - ${db.type}`,
      value: db,
    }))

    const selectedDb = await this.context.logger.select({
      message: 'Select a database',
      choices: dbChoices,
    })

    // Select role
    const roleChoices = [
      { name: 'Superuser', value: 'superuser' },
      { name: 'Admin', value: 'admin' },
      { name: 'Reader', value: 'reader' },
    ]

    const selectedRole = await this.context.logger.select({
      message: 'Select database role',
      choices: roleChoices,
    })

    // Validate the selected role
    const roleResult = vaultRoleSchema.safeParse(selectedRole)
    if (!roleResult.success) {
      throw new PanfactumZodError('Invalid database role', 'role', roleResult.error)
    }
    const validatedRole = roleResult.data

    // Get local port
    const localPort = validatedPort ?? await getOpenPort()

    // Step 2: Get temporary credentials
    const vaultRole = getVaultRole(selectedDb, validatedRole)


    const credentials = await getTempCredentials(
      context, 
      config.vault_addr, 
      vaultRole,
      selectedDb.type,
      selectedDb.name,
      selectedDb.namespace
    )

    // Step 3: Create tunnel
    // Use the service from annotations if available, otherwise construct it
    const serviceName = selectedDb.annotations?.['panfactum.com/service'] || 
      (selectedDb.type === 'postgresql' 
        ? `${selectedDb.namespace}.${selectedDb.name}-rw`
        : `${selectedDb.namespace}.${selectedDb.name}`)

    // Display connection info
    context.logger.info(`
  Target Database Connection Details: 

  Database: ${selectedDb.name}\n
  Type: ${selectedDb.type}\n
  Namespace: ${selectedDb.namespace}`);
    
    
    let connectionDetails = ''
    if (selectedDb.type === 'nats') {
      const {ca, cert, key} = credentials.certs || {};

      connectionDetails = `
  Credentials saved to ${context.repoVariables.nats_dir} and will expire based on your vault_credential_lifetime_hours(default: 16 hours).

  To connect using the NATS CLI, set the following environment variables:

  export NATS_CA=${ca}
  export NATS_CERT=${cert}
  export NATS_KEY=${key}
  export NATS_URL=tls://127.0.0.1:${localPort}

  If using a different client, configure TLS authentication using the above values.`
    } else {
      connectionDetails = `
  Connection details:
  
  Host: localhost
  
  Port: ${localPort}
  
  Username: ${credentials.username}
  
  Password: ${credentials.password}`
    }
    
    context.logger.info(`${connectionDetails}`)

    let connectionString = ''
    if (selectedDb.type === 'postgresql') {
      connectionString = `postgresql://${credentials.username}:${credentials.password}@localhost:${localPort}/postgres`
    } else if (selectedDb.type === 'redis') {
      connectionString = `redis://:${credentials.password}@localhost:${localPort}`
    }

    if (connectionString) {
      context.logger.info(`Connection String: ${connectionString}`)
    }

    // Validate vault address
    if (!config.vault_addr) {
      throw new CLIError(`Vault address not configured for context ${config.kube_config_context}`)
    }

    // Create tunnel
    const tunnelHandle = await createSSHTunnel({
      context,
      bastionName: config.kube_config_context,
      remoteAddress: `${serviceName}:${selectedDb.port}`,
      localPort,
      vaultAddress: config.vault_addr
    })

    // Handle cleanup on process termination
    const cleanup = async () => {
      if (credentials.leaseId) {
        context.logger.info('Revoking database credentials...')
        const vaultToken = await getVaultToken({ context, address: config.vault_addr! })
        await execute({
          command: ['vault', 'lease', 'revoke', credentials.leaseId],
          context,
          workingDirectory: process.cwd(),
          env: { 
            ...process.env,
            VAULT_ADDR: config.vault_addr,
            VAULT_TOKEN: vaultToken 
          },
        }).catch((error) => {
          // Log cleanup errors but don't throw
          context.logger.debug('Error during tunnel cleanup', { error })
        })
      }
      await tunnelHandle.close()
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    // Keep the command running until terminated
    return new Promise(() => {
      // This promise never resolves naturally - it waits for process termination
      // The cleanup handlers above will exit the process
    })
  }
}
