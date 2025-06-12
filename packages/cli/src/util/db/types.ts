import { z } from 'zod'

// Zod schemas for database types
export const databaseTypeSchema = z.enum(['postgresql', 'redis', 'nats'])
export type DatabaseType = z.infer<typeof databaseTypeSchema>
export const databaseTypes = databaseTypeSchema.options

export const vaultRoleSchema = z.enum(['superuser', 'admin', 'reader'])
export type VaultRole = z.infer<typeof vaultRoleSchema>
export const vaultRoles = vaultRoleSchema.options

export interface Database {
  name: string
  namespace: string
  type: DatabaseType
  port: number
  annotations?: {
    'panfactum.com/superuser-role'?: string
    'panfactum.com/admin-role'?: string
    'panfactum.com/reader-role'?: string
    'panfactum.com/service'?: string
    'panfactum.com/service-port'?: string
  }
}

export interface DatabaseCredentials {
  username: string
  password: string
  certs?: {
    ca: string
    cert: string
    key: string
  }
  leaseId?: string
}

export interface DatabaseTunnelConfig {
  database: Database
  role: VaultRole
  localPort: number
  credentials: DatabaseCredentials
}