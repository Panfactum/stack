output "pod_template" {
  value = local.pod
}

output "match_labels" {
  value = local.match_labels
}

output "containers" {
  value = local.containers
}

output "init_containers" {
  value = local.init_containers
}
