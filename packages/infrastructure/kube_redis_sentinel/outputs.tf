output "root_name" {
  description = "The name of the superuser of the database"
  value       = "default"
}

output "root_password" {
  description = "The password for root user of the database"
  value       = random_password.superuser_password.result
  sensitive   = true
}

output "superuser_creds_secret" {
  description = "The name of the Kubernetes Secret holding credentials for the superuser role in the Redis database"
  value       = "${random_id.id.hex}-superuser-creds"
}

output "admin_creds_secret" {
  description = "The name of the Kubernetes Secret holding credentials for the admin role in the Redis database"
  value       = "${random_id.id.hex}-admin-creds"
}

output "reader_creds_secret" {
  description = "The name of the Kubernetes Secret holding credentials for the reader role in the Redis database"
  value       = "${random_id.id.hex}-reader-creds"
}


output "redis_master_host" {
  description = "A service address that points to only the writable redis master"
  value       = "${random_id.id.hex}-master.${var.namespace}"
}

output "redis_port" {
  description = "The port that the Redis servers listen on"
  value       = 6379
}

output "redis_sentinel_host" {
  description = "A service address that points to the Redis Sentinels"
  value       = "${random_id.id.hex}.${var.namespace}"
}

output "redis_sentinel_port" {
  description = "The port that the Sentinel servers listen on"
  value       = 26379
}

output "redis_host" {
  description = "A service address that points to all Redis nodes"
  value       = "${random_id.id.hex}.${var.namespace}"
}

output "admin_role" {
  description = "The Vault role used to get admin credentials for the created Redis cluster"
  value       = vault_database_secret_backend_role.admin.name
}

output "superuser_role" {
  description = "The Vault role used to get superuser credentials for the created Redis cluster"
  value       = vault_database_secret_backend_role.reader.name
}

output "reader_role" {
  description = "The Vault role used to get read-only credentials for the created Redis cluster"
  value       = vault_database_secret_backend_role.superuser.name
}

output "master_set" {
  description = "The value for the master set to use when configuring Sentinel-aware Redis clients"
  value       = "mymaster"
}

output "redis_host_list" {
  description = "A list of domain names for every Redis pod in the cluster"
  value       = [for i in range(var.replica_count) : "${random_id.id.hex}-node-${i}.${random_id.id.hex}-headless.${var.namespace}"]
}

output "namespace" {
  description = "Kubernetes namespace where module resources are created"
  value       = var.namespace
}

output "match_labels" {
  description = "A label selector that matches all Redis pods in the cluster"
  value       = module.util.match_labels
}

output "match_labels_master" {
  description = "A label selector that matches only the Redis master pod in the cluster"
  value = merge(
    module.util.match_labels,
    {
      isMaster = "true"
    }
  )
}
