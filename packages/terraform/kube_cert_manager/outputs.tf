output "service_account" {
  value = kubernetes_service_account.cert_manager.metadata[0].name
}

output "namespace" {
  value = local.namespace
}