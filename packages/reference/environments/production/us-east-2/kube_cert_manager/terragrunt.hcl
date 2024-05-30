include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cilium" {
  config_path  = "../kube_cilium"
  skip_outputs = true
}

inputs = {
  pull_through_cache_enabled   = true
  self_generated_certs_enabled = false
  vpa_enabled                  = true

  # Alpha: Do not use
  monitoring_enabled = true
  canary_enabled     = true
}
