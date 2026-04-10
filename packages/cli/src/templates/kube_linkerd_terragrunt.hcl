include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "kube_certificates" {
  config_path = "../kube_certificates"
}

dependency "kyverno" {
  config_path  = "../kube_kyverno"
  skip_outputs = true
}

inputs = {
  vault_ca_crt = dependency.kube_certificates.outputs.vault_ca_crt

  # You should keep monitoring of this module disabled unless you need
  # granular request / tcp packet inspection as this adds significant
  # extra cost which scales linearly with the size of your cluster
  monitoring_enabled = false
}
