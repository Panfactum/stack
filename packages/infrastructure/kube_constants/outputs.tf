output "cilium_taint" {
  description = "The taint added to every node before the Cilium pods are ready (i.e., when networking is unavailable)"
  value = {
    key    = "node.cilium.io/agent-not-ready"
    value  = "true"
    effect = "NoSchedule"
  }
}

output "default_priority_class_name" {
  description = "The default Kubernetes Priority Class"
  value       = "default"
}

output "database_priority_class_name" {
  description = "A Kubernetes Priority Class that is higher than the default but lower than cluster-important. All stateful systems should have this priority class."
  value       = "database"
}

output "cluster_important_priority_class_name" {
  description = "A Kubernetes Priority Class that is higher than the database but lower than system-cluster-critical."
  value       = "cluster-important"
}

output "panfactum_scheduler_name" {
  description = "The name to use for the 'schedulerName' pod spec field when you want to use the Panfactum bin-packing pod scheduler."
  value       = "panfactum"
}

output "panfactum_image" {
  description = "The repository of the Panfactum devenv image with the AWS public ECR registry (public.ecr.aws)."
  value       = "t8f0s7h5/panfactum"
}

output "panfactum_image_version" {
  description = "The tag of the Panfactum devenv image that is compatible with this module's version of the Panfactum stack."
  value       = "39c732f4ab04127ed52c91a96c544a4e4abc0bb6"
}
