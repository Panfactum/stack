include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "kube_authentik" {
  config_path  = "../kube_authentik"
  skip_outputs = true
}

dependency "core_resources" {
  config_path  = "../authentik_core_resources"
  skip_outputs = true
}

inputs = {
  organization_name = "Panfactum"
  vault_name        = "vault-production"
  vault_domain      = "vault.prod.panfactum.com"
  authentik_domain  = "authentik.panfactum.com"
  allowed_groups    = ["superusers"]
}
