output "namespace" {
  value = local.namespace
}

output "grafana_admin_password" {
  value     = random_password.grafana_admin_pw.result
  sensitive = true
}

output "grafana_db_recovery_directory" {
  description = "The name of the directory in the backup bucket that contains the Grafana PostgreSQL backups and WAL archives"
  value       = module.grafana_db.recovery_directory
}

output "thanos_query_frontend_url" {
  value = "http://thanos-query-frontend.${local.namespace}.svc.cluster.local:9090"
}

output "bucket_web_url" {
  value = "https://${local.bucket_web_domain}"
}
