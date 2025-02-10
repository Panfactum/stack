include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cert_manager" {
  config_path  = "../kube_cert_manager"
  skip_outputs = true
}

dependency "cert_issuers" {
  config_path = "../kube_cert_issuers"
}

dependency "kyverno" {
  config_path  = "../kube_kyverno"
  skip_outputs = true
}

inputs = {
  vault_ca_crt = dependency.cert_issuers.outputs.vault_ca_crt

  # You should keep monitoring of this module disabled unless you need
  # granular request / tcp packet inspection as this adds significant
  # extra cost which scales linearly with the size of your cluster
  monitoring_enabled = false
}