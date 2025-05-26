import { execute } from '../subprocess/execute'
import type { Database, DatabaseType } from './types'
import type { PanfactumContext } from '@/util/context/context'

export async function listDatabases(
  context: PanfactumContext,
  namespace?: string,
  type?: DatabaseType
): Promise<Database[]> {
  const databases: Database[] = []

  // List PostgreSQL databases
  if (!type || type === 'postgresql') {
    const pgCommand = namespace
      ? `kubectl get cluster.postgresql.cnpg.io -n ${namespace} -o json`
      : 'kubectl get cluster.postgresql.cnpg.io --all-namespaces -o json'

    try {
      const { stdout } = await execute({
        command: pgCommand.split(' '),
        context,
        workingDirectory: process.cwd(),
      })
      const result = JSON.parse(stdout)

      for (const item of result.items || []) {
        databases.push({
          name: item.metadata.name,
          namespace: item.metadata.namespace,
          type: 'postgresql',
          port: 5432,
        })
      }
    } catch {
      // No PostgreSQL clusters found
    }
  }

  // List Redis databases  
  if (!type || type === 'redis') {
    const redisCommand = namespace
      ? `kubectl get redisfailovers.databases.spotahome.com -n ${namespace} -o json`
      : 'kubectl get redisfailovers.databases.spotahome.com --all-namespaces -o json'

    try {
      const { stdout } = await execute({
        command: redisCommand.split(' '),
        context,
        workingDirectory: process.cwd(),
      })
      const result = JSON.parse(stdout)

      for (const item of result.items || []) {
        databases.push({
          name: item.metadata.name,
          namespace: item.metadata.namespace,
          type: 'redis',
          port: 6379,
        })
      }
    } catch {
      // No Redis clusters found
    }
  }

  // List NATS clusters
  if (!type || type === 'nats') {
    const natsCommand = namespace
      ? `kubectl get statefulset -n ${namespace} -l app.kubernetes.io/name=nats -o json`
      : 'kubectl get statefulset --all-namespaces -l app.kubernetes.io/name=nats -o json'

    try {
      const { stdout } = await execute({
        command: natsCommand.split(' '),
        context,
        workingDirectory: process.cwd(),
      })
      const result = JSON.parse(stdout)

      for (const item of result.items || []) {
        databases.push({
          name: item.metadata.name,
          namespace: item.metadata.namespace,
          type: 'nats',
          port: 4222,
        })
      }
    } catch {
      // No NATS clusters found
    }
  }

  return databases
}