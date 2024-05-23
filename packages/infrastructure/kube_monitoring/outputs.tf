output "namespace" {
  value = local.namespace
}

output "grafana_admin_password" {
  value     = random_password.grafana_admin_pw.result
  sensitive = true
}

output "thanos_query_frontend_url" {
  value = "http://thanos-query-frontend.${local.namespace}.svc.cluster.local:9090"
}

output "bucket_web_url" {
  value = "https://${local.bucket_web_domain}"
}
