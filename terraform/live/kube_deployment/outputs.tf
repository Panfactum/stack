output "match_labels" {
  description = "The labels unique to this deployment that can be used to select the pods in this deployment"
  value       = module.pod_template.match_labels
}

output "service" {
  description = "The name of the kubernetes service created for this deployment."
  value       = kubernetes_service.service.metadata[0].name
}
