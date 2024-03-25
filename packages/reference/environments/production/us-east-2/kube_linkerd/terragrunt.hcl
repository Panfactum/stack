include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "../../../../../terraform//kube_linkerd"
  #source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_linkerd"
}

dependency "cert_manager" {
  config_path  = "../kube_cert_manager"
  skip_outputs = true
}

dependency "trust_manager" {
  config_path  = "../kube_trust_manager"
  skip_outputs = true
}

dependency "cert_issuers" {
  config_path = "../kube_cert_issuers"
}

inputs = {
  vault_ca_crt               = dependency.cert_issuers.outputs.vault_ca_crt
  pull_through_cache_enabled = true
  vpa_enabled                = true
}
