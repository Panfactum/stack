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

inputs = {
  vault_domain = dependency.vault.outputs.vault_domain
}