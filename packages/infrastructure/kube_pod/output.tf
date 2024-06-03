output "pod_template" {
  value = local.pod
}

output "match_labels" {
  value = module.util.match_labels
}

output "labels" {
  value = module.util.labels
}

output "containers" {
  value = local.containers
}

output "init_containers" {
  value = local.init_containers
}
