import type { Database, VaultRole } from './types'

export function getVaultRole(
  database: Database,
  role: VaultRole
): string {
  // Check if the role is provided in annotations
  if (database.annotations) {
    const roleMap: Record<VaultRole, keyof NonNullable<Database['annotations']>> = {
      superuser: 'panfactum.com/superuser-role',
      admin: 'panfactum.com/admin-role',
      reader: 'panfactum.com/reader-role',
    }
    
    const annotationKey = roleMap[role]
    const annotationValue = database.annotations[annotationKey]
    
    if (annotationValue) {
      // The annotation value already contains the full path after db/creds/
      return `db/creds/${annotationValue}`
    }
  }
  
  // Fallback to constructing the role path
  const roleMap: Record<VaultRole, string> = {
    superuser: 'superuser',
    admin: 'admin', 
    reader: 'reader',
  }

  const typeMap: Record<Database['type'], string> = {
    postgresql: 'pg',
    redis: 'redis',
    nats: 'nats',
  }

  return `db/creds/${database.namespace}-${typeMap[database.type]}-${database.name}-${roleMap[role]}`
}