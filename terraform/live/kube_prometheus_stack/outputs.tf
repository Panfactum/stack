output "namespace" {
  value = local.namespace
}

output "grafana_admin_password" {
  value     = random_password.grafana_admin_pw.result
  sensitive = true
}
