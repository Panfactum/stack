output "match_labels" {
  description = "The labels unique to this deployment that can be used to select the pods in this deployment"
  value       = module.pod_template.match_labels
}

output "labels" {
  description = "The labels assigned to all resources in this deployment"
  value       = module.pod_template.labels
}

output "headless_service_name" {
  description = "The name of the headless service where StatefulSet pods are registered"
  value       = "${var.name}-headless"
}

output "service_account_name" {
  description = "The service account used for the pods"
  value       = kubernetes_service_account.service_account.metadata[0].name
}

output "service_name" {
  description = "The name of the service for the deployment"
  value       = length(keys(local.service_ports)) > 0 ? module.service[0].service_name : null
}
