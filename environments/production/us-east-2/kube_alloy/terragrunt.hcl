include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "monitoring" {
  config_path  = "../kube_monitoring"
  skip_outputs = true
}

dependency "logging" {
  config_path  = "../kube_logging"
  skip_outputs = true
}

inputs = {}
