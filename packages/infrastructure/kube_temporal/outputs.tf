output "namespace" {
  description = "The Kubernetes namespace where Temporal is deployed"
  value       = local.namespace
}

output "frontend_service_name" {
  description = "The Kubernetes Service name for the Temporal frontend (gRPC endpoint for clients)"
  value       = "temporal-frontend"
}

output "frontend_port" {
  description = "The gRPC port for the Temporal frontend service"
  value       = 7233
}

output "frontend_host" {
  description = "The full internal hostname for the Temporal frontend (usable within the cluster)"
  value       = "temporal-frontend.${local.namespace}.svc.cluster.local"
}

output "ui_service_name" {
  description = "The Kubernetes Service name for the Temporal Web UI"
  value       = "temporal-ui"
}

output "ui_port" {
  description = "The HTTP port for the Temporal Web UI service"
  value       = 8080
}

output "superuser_creds_secret" {
  description = "The name of the Kubernetes Secret containing the PostgreSQL superuser credentials used by Temporal"
  value       = module.database.superuser_creds_secret
  sensitive   = true
}

output "db_admin_role" {
  description = "The Vault role for obtaining admin database credentials"
  value       = module.database.db_admin_role
}

output "db_reader_role" {
  description = "The Vault role for obtaining read-only database credentials"
  value       = module.database.db_reader_role
}