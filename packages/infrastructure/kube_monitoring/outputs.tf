output "namespace" {
  value = local.namespace
}

output "grafana_admin_password" {
  value     = random_password.grafana_admin_pw.result
  sensitive = true
}

output "db_backup_bucket" {
  description = "The name of the S3 bucket that contains the PostgreSQL backups and WAL archives for Grafana"
  value       = module.grafana_db.backup_bucket_name
}

output "db_backup_directory" {
  description = "The name of the directory in the backup bucket that contains the PostgreSQL backups and WAL archives for Grafana"
  value       = module.grafana_db.backup_directory
}

output "thanos_query_frontend_url" {
  value = "http://thanos-query-frontend.${local.namespace}.svc.cluster.local:9090"
}

output "bucket_web_url" {
  value = "https://${local.bucket_web_domain}"
}
