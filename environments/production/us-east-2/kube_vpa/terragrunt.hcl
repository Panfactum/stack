include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "certificates" {
  config_path  = "../kube_certificates"
  skip_outputs = true
}

# Alpha: Do not use
dependency "monitoring" {
  config_path = "../kube_monitoring"
}

inputs = {
  # Alpha: Do not use
  prometheus_enabled        = false
  thanos_query_frontend_url = dependency.monitoring.outputs.thanos_query_frontend_url
}
