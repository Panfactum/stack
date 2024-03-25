include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "../../../../../terraform//kube_trust_manager"
  #source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_trust_manager"
}

dependency "cert_manager" {
  config_path  = "../kube_cert_manager"
  skip_outputs = true
}

inputs = {
  pull_through_cache_enabled = true
  vpa_enabled                = true
}
