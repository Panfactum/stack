output "root_username" {
  description = "The root user of the database"
  value       = "postgres"
}

output "root_password" {
  description = "The password for root user of the database"
  value       = random_password.superuser_password.result
  sensitive   = true
}

output "superuser_creds_secret" {
  description = "The name of the Kubernetes Secret holding credentials for the superuser role in the PostgreSQL database"
  value       = "${local.cluster_name}-superuser-creds"
}

output "admin_creds_secret" {
  description = "The name of the Kubernetes Secret holding credentials for the admin role in the PostgreSQL database"
  value       = "${local.cluster_name}-admin-creds"
}

output "reader_creds_secret" {
  description = "The name of the Kubernetes Secret holding credentials for the reader role in the PostgreSQL database"
  value       = "${local.cluster_name}-reader-creds"
}

output "database" {
  description = "The database to use for application data"
  value       = "app"
}

output "namespace" {
  description = "The Kubernetes namespace for the created resources"
  value       = var.pg_cluster_namespace
}

output "server_certs_secret" {
  description = "The secret containing the server certificates for the database"
  value       = module.server_certs.secret_name
}

output "pooler_rw_match_labels" {
  description = "Label selector that matches all PgBouncer pods that allows read-write access to the PostgreSQL cluster"
  value       = module.util_pooler["rw"].match_labels
}

output "pooler_rw_service_name" {
  description = "The service name of the PgBouncer connection pooler that allows read-write access"
  value       = "${local.cluster_name}-pooler-rw.${var.pg_cluster_namespace}"
}

output "pooler_rw_service_port" {
  description = "The PostgreSQL port for this service"
  value       = 5432
}

output "pooler_r_match_labels" {
  description = "Label selector that matches all PgBouncer pods that allows read-only access to the PostgreSQL cluster"
  value       = module.util_pooler["rw"].match_labels
}

output "pooler_r_service_name" {
  description = "The service name of the PgBouncer connection pooler that allows read-only access"
  value       = "${local.cluster_name}-pooler-r.${var.pg_cluster_namespace}"
}

output "pooler_r_service_port" {
  description = "The PostgreSQL port for this service"
  value       = 5432
}

output "cluster_match_labels" {
  description = "Label selector that matches all PostgreSQL pods"
  value       = module.util_cluster.match_labels
}

output "cluster_rw_match_labels" {
  description = "Label selector that matches the primary PostgreSQL pod (the read-write node)"
  value = merge(
    module.util_cluster.match_labels,
    {
      role = "primary"
    }
  )
}

output "cluster_ro_match_labels" {
  description = "Label selector that matches all read-only replica PostgreSQL pods"
  value = merge(
    module.util_cluster.match_labels,
    {
      role = "replica"
    }
  )
}

output "rw_service_name" {
  description = "The service name of the db node that allows read-write access"
  value       = "${local.cluster_name}-rw.${var.pg_cluster_namespace}"
}

output "rw_service_port" {
  description = "The PostgreSQL port for this service"
  value       = 5432
}

output "ro_service_name" {
  description = "The service name for the db instances that allows read-only access"
  value       = "${local.cluster_name}-ro.${var.pg_cluster_namespace}"
}

output "ro_service_port" {
  description = "The PostgreSQL port for this service"
  value       = 5432
}

output "r_service_name" {
  description = "The service name for all db instances that allows read access (includes read-write instances as well)"
  value       = "${local.cluster_name}-r.${var.pg_cluster_namespace}"
}

output "r_service_port" {
  description = "The PostgreSQL port for this service"
  value       = 5432
}

output "db_admin_role" {
  description = "The Vault role used to get admin credentials for the created PostgreSQL cluster"
  value       = vault_database_secret_backend_role.admin.name
}

output "db_superuser_role" {
  description = "The Vault role used to get superuser credentials for the created PostgreSQL cluster"
  value       = vault_database_secret_backend_role.superuser.name
}

output "db_reader_role" {
  description = "The Vault role used to get read-only credentials for the created PostgreSQL cluster"
  value       = vault_database_secret_backend_role.reader.name
}

output "recovery_directory" {
  description = "The name of the directory in the backup bucket that contains the PostgreSQL backups and WAL archives"
  value       = random_id.recovery_directory.hex
}



