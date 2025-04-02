include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "metrics-server" {
  config_path  = "../kube_metrics_server"
  skip_outputs = true
}

inputs = {
  # Only set to true if you have deployed kube_monitoring. Otherwise, leave false.
  prometheus_enabled = false
}
