include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "vault" {
  config_path = "../kube_vault"
}

dependency "kyverno" {
  config_path  = "../kube_kyverno"
  skip_outputs = true
}

inputs = {
  grafana_domain = "grafana.prod.panfactum.com"
  vault_domain   = dependency.vault.outputs.vault_domain

  ingress_enabled = true
}
