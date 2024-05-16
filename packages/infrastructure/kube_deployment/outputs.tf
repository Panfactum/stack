output "match_labels" {
  description = "The labels unique to this deployment that can be used to select the pods in this deployment"
  value       = module.pod_template.match_labels
}