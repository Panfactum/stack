import { execute } from '../subprocess/execute'
import type { Database, DatabaseType } from './types'
import type { PanfactumContext } from '@/util/context/context'

export async function listDatabases(
  context: PanfactumContext,
  type?: DatabaseType
): Promise<Database[]> {
  const databases: Database[] = []

  // List PostgreSQL databases
  if (!type || type === 'postgresql') {
    const pgCommand = 'kubectl get cluster.postgresql.cnpg.io --all-namespaces -o json'

    const { stdout } = await execute({
      command: pgCommand.split(' '),
      context,
      workingDirectory: context.repoVariables.repo_root,
    })
    const result = JSON.parse(stdout)

    for (const item of result.items || []) {
      const annotations = item.metadata.annotations || {}
      const port = annotations['panfactum.com/service-port'] 
        ? parseInt(annotations['panfactum.com/service-port'], 10) 
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
      workingDirectory: context.repoVariables.repo_root,
    })
    const result = JSON.parse(stdout)
    
    // Filter for Redis databases by annotation
    for (const item of result.items || []) {
      const annotations = item.metadata.annotations || {}
      if (annotations['panfactum.com/db-type'] === 'Redis') {
        const port = annotations['panfactum.com/service-port'] 
          ? parseInt(annotations['panfactum.com/service-port'], 10) 
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
      workingDirectory: context.repoVariables.repo_root,
    })
    const result = JSON.parse(stdout)
    
    // Filter for NATS databases by annotation
    for (const item of result.items || []) {
      const annotations = item.metadata.annotations || {}
      if (annotations['panfactum.com/db-type'] === 'NATS') {
        const port = annotations['panfactum.com/service-port'] 
          ? parseInt(annotations['panfactum.com/service-port'], 10) 
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