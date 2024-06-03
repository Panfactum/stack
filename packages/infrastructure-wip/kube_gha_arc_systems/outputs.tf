output "namespace" {
  value = local.namespace
}

output "service_account_name" {
  value = kubernetes_service_account.arc.metadata[0].name
}
