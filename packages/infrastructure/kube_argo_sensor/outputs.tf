output "service_account_name" {
  value = kubernetes_service_account.sensor.metadata[0].name
}
