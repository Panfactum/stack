include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "../../../../../terraform//kube_vpa"
  #source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_vpa"
}

dependency "cert_issuers" {
  config_path  = "../kube_cert_issuers"
  skip_outputs = true
}

inputs = {
  pull_through_cache_enabled = true
  vpa_enabled                = true
  log_verbosity              = 5
}
