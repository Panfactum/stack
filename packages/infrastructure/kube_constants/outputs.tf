output "cilium_taint" {
  value = {
    key    = "node.cilium.io/agent-not-ready"
    value  = "true"
    effect = "NoSchedule"
  }
}

output "database_priority_class_name" {
  value = "database"
}

output "default_priority_class_name" {
  value = "default"
}

output "cluster_important_priority_class_name" {
  value = "cluster-important"
}

output "panfactum_scheduler_name" {
  value = "panfactum"
}

output "panfactum_image" {
  value = "t8f0s7h5/panfactum"
}

output "panfactum_image_version" {
  value = "570f0b99af1073c599e2fab9060e53e295122c95"
}
