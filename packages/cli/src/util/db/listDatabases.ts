// This file provides utilities for discovering databases deployed in Kubernetes
// It queries different resource types to find PostgreSQL, Redis, and NATS instances

import { z } from 'zod'
import { parseJson } from '@/util/json/parseJson'
import { execute } from '../subprocess/execute'
import type { IDatabase, DatabaseType } from './types'
import type { PanfactumContext } from '@/util/context/context'

/**
 * Input parameters for listing databases
 */
interface IListDatabasesInput {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext;
  /** Filter by specific database type (optional) */
  type?: DatabaseType;
}

/**
 * Lists all databases deployed in the Kubernetes cluster
 * 
 * @remarks
 * This function discovers databases across all namespaces by querying
 * specific Kubernetes resource types:
 * 
 * 1. **PostgreSQL**: Queries CloudNativePG Cluster resources
 *    - CRD: cluster.postgresql.cnpg.io
 *    - Default port: 5432
 *    - Identifies by resource type
 * 
 * 2. **Redis**: Queries StatefulSets with specific annotations
 *    - Annotation: panfactum.com/db-type=Redis
 *    - Default port: 6379
 *    - Identifies by annotation
 * 
 * 3. **NATS**: Queries StatefulSets with specific annotations
 *    - Annotation: panfactum.com/db-type=NATS
 *    - Default port: 4222
 *    - Identifies by annotation
 * 
 * The function extracts metadata including:
 * - Database name and namespace
 * - Service port from annotations
 * - Vault role mappings
 * - Service configuration
 * 
 * Common use cases:
 * - Database inventory and discovery
 * - Connection string generation
 * - Automated backup scheduling
 * - Security auditing
 * 
 * @param input - Configuration for database discovery
 * @returns Array of discovered databases with metadata
 * 
 * @example
 * ```typescript
 * // List all databases
 * const allDatabases = await listDatabases({ context });
 * console.log(`Found ${allDatabases.length} databases`);
 * ```
 * 
 * @example
 * ```typescript
 * // List only PostgreSQL databases
 * const pgDatabases = await listDatabases({
 *   context,
 *   type: 'postgresql'
 * });
 * 
 * pgDatabases.forEach(db => {
 *   console.log(`PostgreSQL: ${db.namespace}/${db.name}`);
 * });
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when kubectl commands fail
 * 
 * @throws {@link PanfactumZodError}
 * Throws when kubectl output doesn't match expected schema
 * 
 * @see {@link IDatabase} - Database structure returned
 * @see {@link DatabaseType} - Supported database types
 */
export async function listDatabases(
  input: IListDatabasesInput
): Promise<IDatabase[]> {
  const { context, type } = input;
  const databases: IDatabase[] = []

  /**
   * Schema for kubectl get commands with JSON output
   * 
   * @remarks
   * Validates the JSON structure returned by `kubectl get` commands.
   * Used for parsing database resource lists from Kubernetes API including
   * PostgreSQL clusters, Redis instances, and other database types.
   * 
   * @example
   * ```typescript
   * const result = parseJson(kubectlListSchema, kubectlOutput);
   * result.items.forEach(item => console.log(item.metadata.name));
   * ```
   */
  const kubectlListSchema = z.object({
    items: z.array(z.object({
      metadata: z.object({
        /** Resource name */
        name: z.string().describe('Kubernetes resource name'),
        /** Resource namespace */
        namespace: z.string().describe('Kubernetes namespace'),
        /** Resource annotations containing database metadata */
        annotations: z.record(z.string()).optional().describe('Kubernetes annotations')
      }).describe('Kubernetes resource metadata')
    }).describe('Kubernetes resource'))
  }).describe('Kubernetes resource list response');

  // List PostgreSQL databases
  if (!type || type === 'postgresql') {
    const pgCommand = 'kubectl get cluster.postgresql.cnpg.io --all-namespaces -o json'

    const { stdout } = await execute({
      command: pgCommand.split(' '),
      context,
      workingDirectory: context.devshellConfig.repo_root,
    })

    // Parse and validate JSON response
    const result = parseJson(kubectlListSchema, stdout)

    for (const item of result.items) {
      const annotations = item.metadata.annotations || {}
      const portString = annotations['panfactum.com/service-port']
      const port = portString
        ? parseInt(portString, 10)
        : 5432

      databases.push({
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        type: 'postgresql',
        port,
        annotations,
      })
    }
  }

  // List Redis databases  
  if (!type || type === 'redis') {
    const stsCommand = 'kubectl get statefulset --all-namespaces -o json'

    const { stdout } = await execute({
      command: stsCommand.split(' '),
      context,
      workingDirectory: context.devshellConfig.repo_root,
    })

    // Parse and validate JSON response
    const result = parseJson(kubectlListSchema, stdout)

    // Filter for Redis databases by annotation
    for (const item of result.items) {
      const annotations = item.metadata.annotations || {}
      if (annotations['panfactum.com/db-type'] === 'Redis') {
        const portString = annotations['panfactum.com/service-port']
        const port = portString
          ? parseInt(portString, 10)
          : 6379

        databases.push({
          name: item.metadata.name,
          namespace: item.metadata.namespace,
          type: 'redis',
          port,
          annotations,
        })
      }
    }
  }

  // List NATS clusters
  if (!type || type === 'nats') {
    const stsCommand = 'kubectl get statefulset --all-namespaces -o json'

    const { stdout } = await execute({
      command: stsCommand.split(' '),
      context,
      workingDirectory: context.devshellConfig.repo_root,
    })

    // Parse and validate JSON response
    const result = parseJson(kubectlListSchema, stdout)

    // Filter for NATS databases by annotation
    for (const item of result.items) {
      const annotations = item.metadata.annotations || {}
      if (annotations['panfactum.com/db-type'] === 'NATS') {
        const portString = annotations['panfactum.com/service-port']
        const port = portString
          ? parseInt(portString, 10)
          : 4222

        databases.push({
          name: item.metadata.name,
          namespace: item.metadata.namespace,
          type: 'nats',
          port,
          annotations,
        })
      }
    }
  }

  return databases
}