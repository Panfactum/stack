output "superuser_username" {
  description = "The root user of the database"
  value       = "postgres"
}

output "superuser_password" {
  description = "The password for root user of the database"
  value       = random_password.superuser_password.result
  sensitive   = true
}

output "database" {
  description = "The database to use for application data"
  value       = "app"
}

output "server_certs_secret" {
  description = "The secret containing the server certificates for the database"
  value       = module.server_certs.secret_name
}

output "pooler_rw_service_name" {
  description = "The service name of the pgbouncer connection pooler that allows read-write access"
  value       = "${local.cluster_name}-pooler-rw.${var.pg_cluster_namespace}"
}

output "pooler_rw_service_port" {
  value = 5432
}

output "pooler_r_service_name" {
  description = "The service name of the pgbouncer connection pooler that allows read access"
  value       = "${local.cluster_name}-pooler-r.${var.pg_cluster_namespace}"
}

output "pooler_r_service_port" {
  value = 5432
}

output "rw_service_name" {
  description = "The service name of the db node that allows read-write access"
  value       = "${local.cluster_name}-rw.${var.pg_cluster_namespace}"
}

output "rw_service_port" {
  value = 5432
}

output "ro_service_name" {
  description = "The service name for the db instances that only allow read access"
  value       = "${local.cluster_name}-ro.${var.pg_cluster_namespace}"
}

output "ro_service_port" {
  value = 5432
}

output "r_service_name" {
  description = "The service name for all db instances that allow read access"
  value       = "${local.cluster_name}-r.${var.pg_cluster_namespace}"
}

output "r_service_port" {
  value = 5432
}

output "db_admin_role" {
  value = vault_database_secret_backend_role.admin.name
}

output "db_superuser_role" {
  value = vault_database_secret_backend_role.superuser.name
}

output "db_reader_role" {
  value = vault_database_secret_backend_role.reader.name
}

