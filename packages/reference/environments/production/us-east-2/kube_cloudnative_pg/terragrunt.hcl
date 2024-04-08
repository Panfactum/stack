include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "linkerd" {
  config_path  = "../kube_linkerd"
  skip_outputs = true
}

inputs = {
  log_level                  = "info"
  pull_through_cache_enabled = true
  vpa_enabled                = true
}
