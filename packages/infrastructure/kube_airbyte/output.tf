output "namespace" {
  description = "The namespace where Airbyte is deployed"
  value       = module.namespace.namespace
}

output "ingress_domain" {
  description = "The domain configured for Airbyte ingress"
  value       = var.domain
}

output "webapp_service_name" {
  description = "The name of the Airbyte webapp service"
  value       = "airbyte-webapp"
}

output "webapp_service_port" {
  description = "The port of the Airbyte webapp service"
  value       = 80
}

output "server_service_name" {
  description = "The name of the Airbyte server service"
  value       = "airbyte-server"
}

output "server_service_port" {
  description = "The port of the Airbyte server service"
  value       = 8001
}

output "temporal_service_name" {
  description = "The name of the Airbyte temporal service"
  value       = "airbyte-temporal"
}

output "temporal_service_port" {
  description = "The port of the Airbyte temporal service"
  value       = 7233
}

output "database_credentials_secret" {
  description = "The name of the secret containing database credentials"
  value       = module.database.superuser_creds_secret
}

output "airbyte_url" {
  description = "The URL to access Airbyte"
  value       = var.domain != "" ? "https://${var.domain}" : null
}

output "airbyte_config_secret" {
  description = "The name of the Airbyte configuration secret"
  value       = kubernetes_secret.airbyte_secrets.metadata[0].name
}

output "webapp_labels" {
  description = "Labels applied to the webapp component"
  value       = module.util_webapp.labels
}

output "server_labels" {
  description = "Labels applied to the server component"
  value       = module.util_server.labels
}

output "worker_labels" {
  description = "Labels applied to the worker component"
  value       = module.util_worker.labels
}

output "temporal_labels" {
  description = "Labels applied to the temporal component"
  value       = module.util_temporal.labels
}

output "service_account_name" {
  description = "The name of the Kubernetes service account used by Airbyte pods"
  value       = kubernetes_service_account.airbyte_sa.metadata[0].name
}