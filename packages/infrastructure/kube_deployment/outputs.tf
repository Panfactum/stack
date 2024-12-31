output "match_labels" {
  description = "The labels unique to this Deployment that can be used to select any pods in this Deployment"
  value       = module.pod_template.match_labels
}

output "labels" {
  description = "The default labels assigned to all resources in this Deployment"
  value       = module.pod_template.labels
}

output "service_account_name" {
  description = "The service account used for the pods"
  value       = kubernetes_service_account.service_account.metadata[0].name
}

output "service_name" {
  description = "The name of the service for the deployment"
  value       = length(keys(local.service_ports)) > 0 ? module.service[0].service_name : null
}
