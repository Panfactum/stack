// This file defines types and schemas for database connections and credentials
// It supports PostgreSQL, Redis, and NATS databases with Vault integration

import { z } from 'zod'

/**
 * Schema for validating supported database types in Panfactum infrastructure
 * 
 * @remarks
 * This schema enforces validation of database types supported by the Panfactum
 * framework. The restriction to specific database types ensures compatibility
 * with the framework's deployment, monitoring, and management systems.
 * 
 * **Supported database types and their purposes:**
 * - `postgresql`: Relational database for transactional workloads, ACID compliance
 * - `redis`: In-memory cache/session store for high-performance data access
 * - `nats`: Message broker for event streaming and inter-service communication
 * 
 * **Why only these types are supported:**
 * - **Operational consistency**: Standardized deployment patterns across environments
 * - **Security integration**: Pre-configured with Vault for secret management
 * - **Monitoring coverage**: Built-in observability and alerting configurations
 * - **Backup strategies**: Automated backup and disaster recovery procedures
 * - **Network policies**: Pre-configured Kubernetes network security rules
 * - **Resource management**: Optimized resource allocation and scaling policies
 * 
 * **Business and technical constraints:**
 * - PostgreSQL: Chosen for ACID compliance and SQL compatibility
 * - Redis: Selected for sub-millisecond latency and pub/sub capabilities
 * - NATS: Preferred for cloud-native messaging with clustering support
 * - Exclusions: Other databases lack Panfactum integration modules
 * 
 * **Integration context:**
 * Used throughout the CLI for database discovery, credential management,
 * tunnel creation, and monitoring operations. Ensures that only supported
 * database types can be managed through Panfactum tooling.
 * 
 * **Common validation scenarios:**
 * - Database discovery from Kubernetes annotations
 * - Tunnel creation to specific database types
 * - Credential retrieval from Vault for supported databases
 * - Monitoring setup for known database configurations
 * 
 * @example
 * ```typescript
 * // Valid database types
 * databaseTypeSchema.parse('postgresql'); // Relational DB
 * databaseTypeSchema.parse('redis');      // Cache/sessions
 * databaseTypeSchema.parse('nats');       // Message broker
 * 
 * // Invalid types (will throw)
 * databaseTypeSchema.parse('mysql');      // Not supported
 * databaseTypeSchema.parse('mongodb');    // Not supported
 * databaseTypeSchema.parse('cassandra');  // Not supported
 * ```
 * 
 * @see {@link IDatabase} - For database configuration structure
 * @see {@link vaultRoleSchema} - For database access role validation
 */
export const databaseTypeSchema = z.enum(['postgresql', 'redis', 'nats'])
  .describe('Supported database types in Panfactum infrastructure')

/** Supported database types */
export type DatabaseType = z.infer<typeof databaseTypeSchema>

/** Array of all supported database types */
export const databaseTypes = databaseTypeSchema.options

/**
 * Schema for validating Vault database access roles in Panfactum infrastructure
 * 
 * @remarks
 * This schema enforces the principle of least privilege by validating database
 * access roles managed through HashiCorp Vault's database secrets engine. Each
 * role corresponds to specific database permissions and use cases within the
 * Panfactum security model.
 * 
 * **Database role hierarchy and permissions:**
 * - `superuser`: Full administrative access, schema changes, user management
 * - `admin`: Application-level admin, data manipulation, some schema changes  
 * - `reader`: Read-only access, suitable for reporting and monitoring
 * 
 * **Security and operational constraints:**
 * - **Least privilege principle**: Roles provide minimum necessary permissions
 * - **Audit compliance**: All access is logged and tracked through Vault
 * - **Credential rotation**: Vault automatically rotates database passwords
 * - **Session management**: Credentials have configurable lease durations
 * - **Access control**: Role assignment controls what users can access
 * 
 * **Role-specific use cases:**
 * - `superuser`: Database migrations, emergency recovery, infrastructure setup
 * - `admin`: Application deployments, data management, operational tasks
 * - `reader`: Monitoring queries, business intelligence, read-only analytics
 * 
 * **Business rule enforcement:**
 * - Production environments typically restrict superuser access
 * - Development environments may allow broader admin access
 * - Reader roles ensure data privacy for analytical workloads
 * - Role validation prevents privilege escalation attacks
 * 
 * **Integration with Vault:**
 * - Roles map to Vault database role configurations
 * - Each role has predefined SQL statements for permission grants
 * - Vault enforces role-based credential generation and rotation
 * - TTL (time-to-live) varies by role sensitivity
 * 
 * **Common validation scenarios:**
 * - CLI commands requesting database credentials
 * - Tunnel creation with specific access levels
 * - Application deployment requiring database access
 * - Monitoring setup needing read-only access
 * 
 * @example
 * ```typescript
 * // Valid Vault database roles
 * vaultRoleSchema.parse('superuser'); // Full admin access
 * vaultRoleSchema.parse('admin');     // Application admin
 * vaultRoleSchema.parse('reader');    // Read-only access
 * 
 * // Invalid roles (will throw)
 * vaultRoleSchema.parse('writer');    // Not defined
 * vaultRoleSchema.parse('guest');     // Not supported
 * vaultRoleSchema.parse('root');      // Not in schema
 * ```
 * 
 * @see {@link IDatabaseCredentials} - For credential structure returned by Vault
 * @see {@link IDatabaseTunnelConfig} - For tunnel configuration with roles
 * @see {@link databaseTypeSchema} - For supported database types
 */
export const vaultRoleSchema = z.enum(['superuser', 'admin', 'reader'])
  .describe('Vault database access roles with specific permission levels')

/** Vault role permission levels */
export type VaultRole = z.infer<typeof vaultRoleSchema>

/** Array of all Vault role types */
export const vaultRoles = vaultRoleSchema.options

/**
 * Database configuration and metadata
 * @remarks Contains information needed to connect to a database in Kubernetes
 */
export interface IDatabase {
  /** Database instance name */
  name: string
  /** Kubernetes namespace where the database is deployed */
  namespace: string
  /** Type of database (postgresql, redis, or nats) */
  type: DatabaseType
  /** Port number for database connections */
  port: number
  /** Kubernetes annotations containing Vault role mappings and service info */
  annotations?: {
    /** Vault role for superuser access */
    'panfactum.com/superuser-role'?: string
    /** Vault role for admin access */
    'panfactum.com/admin-role'?: string
    /** Vault role for read-only access */
    'panfactum.com/reader-role'?: string
    /** Kubernetes service name for the database */
    'panfactum.com/service'?: string
    /** Service port for database connections */
    'panfactum.com/service-port'?: string
  }
}

/**
 * Database connection credentials
 * @remarks Contains authentication information retrieved from Vault
 */
export interface IDatabaseCredentials {
  /** Username for database authentication */
  username: string
  /** Password for database authentication */
  password: string
  /** TLS certificates for secure connections (used by NATS) */
  certs?: {
    /** CA certificate file path */
    ca: string
    /** Client certificate file path */
    cert: string
    /** Client private key file path */
    key: string
  }
  /** Vault lease ID for credential renewal/revocation */
  leaseId?: string
}

/**
 * Configuration for database tunnel connections
 * @remarks Combines database info, credentials, and local port mapping
 */
export interface IDatabaseTunnelConfig {
  /** Database configuration */
  database: IDatabase
  /** Vault role used for access */
  role: VaultRole
  /** Local port for tunnel connection */
  localPort: number
  /** Database credentials from Vault */
  credentials: IDatabaseCredentials
}