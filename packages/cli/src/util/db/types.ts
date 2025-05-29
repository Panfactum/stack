export type DatabaseType = 'postgresql' | 'redis' | 'nats'

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

export type VaultRole = 'superuser' | 'admin' | 'reader'

export interface DatabaseTunnelConfig {
  database: Database
  role: VaultRole
  localPort: number
  credentials: DatabaseCredentials
}