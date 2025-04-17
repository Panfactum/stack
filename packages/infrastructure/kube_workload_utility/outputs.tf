output "affinity" {
  description = "The affinity spec to add to each pod"
  value       = local.affinity
}

output "tolerations" {
  description = "The tolerations to add to each pod"
  value       = local.tolerations
}

output "labels" {
  description = "The labels to add to each pod"
  value       = local.labels
}

output "topology_spread_constraints" {
  description = "The topology spread constraints to add to each pod"
  value       = local.topology_spread_constraints
}

output "match_labels" {
  description = "The label selector to use to match pods in this workload"
  value       = local.match_labels
}

output "scheduler_name" {
  description = "The schedulerName to use for the pods in the workload"
  value       = var.panfactum_scheduler_enabled ? "panfactum" : "default-scheduler"
}