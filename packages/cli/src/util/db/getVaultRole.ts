// This file provides utilities for constructing Vault role paths for database access
// It maps database types and permission levels to Vault credential paths

import type { IDatabase, VaultRole } from './types'

/**
 * Input parameters for getting Vault role path
 */
interface IGetVaultRoleInput {
  /** Database configuration with annotations */
  database: IDatabase;
  /** Desired permission level */
  role: VaultRole;
}

/**
 * Constructs the Vault role path for database credential generation
 * 
 * @remarks
 * This function determines the correct Vault path for requesting database
 * credentials based on the database type and desired permission level.
 * 
 * The function uses a two-tier approach:
 * 
 * 1. **Annotation-based**: Checks Kubernetes annotations for custom role paths
 *    - Looks for panfactum.com/{role}-role annotations
 *    - Uses the annotation value if present
 *    - Allows per-database role customization
 * 
 * 2. **Convention-based**: Falls back to standard naming pattern
 *    - Format: db/creds/{namespace}-{type}-{name}-{role}
 *    - Uses abbreviated database type names (pg, redis, nats)
 *    - Ensures consistent role naming across deployments
 * 
 * Role mapping:
 * - superuser: Full database administration rights
 * - admin: Schema and user management capabilities
 * - reader: Read-only access to data
 * 
 * Common use cases:
 * - Database migrations (superuser/admin)
 * - Application runtime access (reader/admin)
 * - Debugging and inspection (reader)
 * - Backup operations (reader)
 * 
 * @param input - Database and role configuration
 * @returns Vault path for credential generation
 * 
 * @example
 * ```typescript
 * // Get admin role for PostgreSQL database
 * const vaultPath = getVaultRole({
 *   database: {
 *     name: 'users',
 *     namespace: 'production',
 *     type: 'postgresql',
 *     port: 5432
 *   },
 *   role: 'admin'
 * });
 * // Returns: "db/creds/production-pg-users-admin"
 * ```
 * 
 * @example
 * ```typescript
 * // Get role with custom annotation
 * const vaultPath = getVaultRole({
 *   database: {
 *     name: 'cache',
 *     namespace: 'staging',
 *     type: 'redis',
 *     port: 6379,
 *     annotations: {
 *       'panfactum.com/reader-role': 'custom-redis-reader'
 *     }
 *   },
 *   role: 'reader'
 * });
 * // Returns: "db/creds/custom-redis-reader"
 * ```
 * 
 * @see {@link VaultRole} - Available permission levels
 * @see {@link IDatabase} - Database configuration structure
 */
export function getVaultRole(
  input: IGetVaultRoleInput
): string {
  const { database, role } = input;
  // Check if the role is provided in annotations
  if (database.annotations) {
    const roleMap: Record<VaultRole, keyof NonNullable<IDatabase['annotations']>> = {
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

  const typeMap: Record<IDatabase['type'], string> = {
    postgresql: 'pg',
    redis: 'redis',
    nats: 'nats',
  }

  return `db/creds/${database.namespace}-${typeMap[database.type]}-${database.name}-${roleMap[role]}`
}