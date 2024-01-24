output "superuser_username" {
  value = "postgres"
}

output "rw_service_name" {
  value = "${var.pg_cluster_name}-rw.${var.pg_cluster_namespace}"
}

output "rw_service_port" {
  value = 5432
}

output "ro_service_name" {
  value = "${var.pg_cluster_name}-ro.${var.pg_cluster_namespace}"
}

output "ro_service_port" {
  value = 5432
}

output "r_service_name" {
  value = "${var.pg_cluster_name}-r.${var.pg_cluster_namespace}"
}

output "r_service_port" {
  value = 5432
}

output "superuser_password" {
  value = random_password.superuser_password.result
}

output "db_admin_role" {
  value = vault_database_secret_backend_role.admin.name
}

output "db_writer_role" {
  value = vault_database_secret_backend_role.writer.name
}

output "db_reader_role" {
  value = vault_database_secret_backend_role.read_only.name
}
