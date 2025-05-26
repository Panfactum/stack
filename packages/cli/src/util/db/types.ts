export type DatabaseType = 'postgresql' | 'redis' | 'nats'

export interface Database {
  name: string
  namespace: string
  type: DatabaseType
  port: number
}

export interface DatabaseCredentials {
  username: string
  password: string
  leaseId?: string
}

export type VaultRole = 'superuser' | 'admin' | 'reader'

export interface DatabaseTunnelConfig {
  database: Database
  role: VaultRole
  localPort: number
  credentials: DatabaseCredentials
}