import { spawn } from 'child_process'
import { Option, Command } from 'clipanion'
import { z } from 'zod'
import {getIdentity} from "@/util/aws/getIdentity.ts";
import { PanfactumCommand } from '@/util/command/panfactumCommand.ts'
import {getEnvironments} from "@/util/config/getEnvironments.ts";
import {getPanfactumConfig} from "@/util/config/getPanfactumConfig.ts";
import { getRegions } from '@/util/config/getRegions'
import { getTempCredentials } from '@/util/db/getTempCredentials.ts'
import { getVaultRole } from '@/util/db/getVaultRole.ts'
import { listDatabases } from '@/util/db/listDatabases.ts'
import { databaseTypeSchema, vaultRoleSchema, type DatabaseType } from '@/util/db/types.ts'
import { CLIError } from '@/util/error/error'
import { getOpenPort } from '@/util/network/getOpenPort.ts'
import { execute } from '@/util/subprocess/execute.ts'
import {GLOBAL_REGION, MANAGEMENT_ENVIRONMENT} from '@/util/terragrunt/constants'
import { getVaultTokenString } from '@/util/vault/getVaultToken'

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

  async execute() {
    const { context } = this

    // Validate type if provided and get properly typed value
    let validatedType: DatabaseType | undefined
    if (this.type) {
      validatedType = databaseTypeSchema.parse(this.type)
    }

    /*******************************************
     * Select Environment and Region
     *******************************************/
    const environments = (await getEnvironments(this.context)).filter(env => env.name !== MANAGEMENT_ENVIRONMENT);

    if (environments.length === 0) {
      throw new CLIError([
        "No environments found. Please run `pf env add` to create an environment first.",
      ]);
    }

    const selectedEnvironment = await this.context.logger.select({
      message: "Select the environment for the cluster:",
      choices: environments.map(env => ({
        value: env,
        name: `${env.name}`
      })),
    });

    const regions = (await getRegions(this.context, selectedEnvironment.path)).filter(region => region.name !== GLOBAL_REGION);

    if (regions.length === 0) {
      throw new CLIError([
        `No available regions found in environment ${selectedEnvironment.name}.`,
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
      throw new CLIError('AWS profile is not configured. Please set aws_profile in your panfactum.json or environment variables.')
    }

    if (!config.kube_config_context) {
      throw new CLIError('Kubernetes context is not configured. Please set kube_config_context in your panfactum.json or environment variables.')
    }

    await getIdentity({ context, profile: config.aws_profile });


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
    const validatedRole = vaultRoleSchema.parse(selectedRole)

    // Get local port
    const localPort = this.port ? portSchema.parse(this.port) : await getOpenPort()

    // Step 2: Get temporary credentials
    const vaultRole = getVaultRole(selectedDb, validatedRole)

    if (!config.vault_addr) {
      throw new CLIError('Vault address is not configured. Please set VAULT_ADDR in your environment variables or configuration.')
    }

    const credentials = await getTempCredentials(
      context, 
      config.vault_addr, 
      vaultRole,
      selectedDb.type,
      selectedDb.name,
      selectedDb.namespace
    )

    context.logger.info('Temporary credentials created successfully')

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
    
    
    let connectionInfo = ''
    if (selectedDb.type === 'nats') {
      const {ca, cert, key} = credentials.certs || {};

      connectionInfo = `
Credentials saved to ${context.repoVariables.nats_dir} and will expire in 16 hours.

To connect using the NATS CLI, set the following environment variables:

  export NATS_CA=${ca}
  export NATS_CERT=${cert}
  export NATS_KEY=${key}
  export NATS_URL=tls://127.0.0.1:${localPort}

If using a different client, configure TLS authentication using the above values.`
    } else {
      connectionInfo = `
Connection details:\n
  Host: localhost\n
  Port: ${localPort}\n
  Username: ${credentials.username}\n
  Password: ${credentials.password}`
    }
    
    context.logger.info(`${connectionInfo}`)

    let connectionString = ''
    if (selectedDb.type === 'postgresql') {
      connectionString = `postgresql://${credentials.username}:${credentials.password}@localhost:${localPort}/postgres`
    } else if (selectedDb.type === 'redis') {
      connectionString = `redis://:${credentials.password}@localhost:${localPort}`
    }

    if (connectionString) {
      context.logger.info(`Connection String: ${connectionString}`)
    }

    // Create tunnel process
    const tunnelProcess = spawn('pf tunnel', [
      config.kube_config_context,
      `${serviceName}:${selectedDb.port.toString()}`,
      '--local-port',
      localPort.toString(),
    ], {
      ...process.env,
      stdio: 'inherit',
      env: process.env,
    })

    // Handle cleanup on process termination
    const cleanup = async () => {
      if (credentials.leaseId) {
        try {
          context.logger.info('Revoking database credentials...')
          const vaultToken = await getVaultTokenString({ context, address: '' })
          await execute({
            command: ['vault', 'lease', 'revoke', credentials.leaseId],
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

    // Wait for tunnel process to exit
    await new Promise<void>((resolve, reject) => {
      tunnelProcess.on('error', reject)
      tunnelProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          reject(new CLIError(`Tunnel process exited with code ${code}`))
        } else {
          resolve()
        }
      })
    })
  }
}