output "superuser_name" {
  description = "The name of the superuser of the database"
  value       = "default"
}

output "superuser_password" {
  description = "The password for root user of the database"
  value       = random_password.superuser_password.result
  sensitive   = true
}

output "redis_master_host" {
  description = "A service address that points to only the writable redis master"
  value       = "${random_id.id.hex}-master.${var.namespace}"
}

output "redis_port" {
  value = 6379
}

output "redis_sentinel_host" {
  description = "A service address that points to the redis sentinels"
  value       = "${random_id.id.hex}.${var.namespace}"
}
output "redis_sentinel_port" {
  value = 26379
}

output "redis_host" {
  description = "A service address that points to all redis nodes"
  value       = "${random_id.id.hex}.${var.namespace}"
}

output "admin_role" {
  value = vault_database_secret_backend_role.admin.name
}

output "writer_role" {
  value = vault_database_secret_backend_role.writer.name
}

output "reader_role" {
  value = vault_database_secret_backend_role.read_only.name
}
