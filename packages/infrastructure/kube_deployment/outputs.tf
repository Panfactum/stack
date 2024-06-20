output "match_labels" {
  description = "The labels unique to this Workflow that can be used to select any pods in this Workflow"
  value       = module.pod_template.match_labels
}

output "labels" {
  description = "The default labels assigned to all resources in this Workflow"
  value       = module.pod_template.labels
}

output "service_account_name" {
  description = "The service account used for the pods"
  value       = kubernetes_service_account.service_account.metadata[0].name
}
