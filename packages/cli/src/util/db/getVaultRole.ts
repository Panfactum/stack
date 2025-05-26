import type { DatabaseType, VaultRole } from './types'

export function getVaultRole(
  databaseType: DatabaseType,
  namespace: string,
  dbName: string,
  role: VaultRole
): string {
  // Format: db/creds/<namespace>-<db-type>-<db-name>-<role>
  const roleMap: Record<VaultRole, string> = {
    superuser: 'superuser',
    admin: 'admin', 
    reader: 'reader',
  }

  const typeMap: Record<DatabaseType, string> = {
    postgresql: 'pg',
    redis: 'redis',
    nats: 'nats',
  }

  return `db/creds/${namespace}-${typeMap[databaseType]}-${dbName}-${roleMap[role]}`
}