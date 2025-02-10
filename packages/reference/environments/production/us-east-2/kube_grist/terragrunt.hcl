include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  vault_domain      = "vault.prod.panfactum.com"
  domain            = "grist.panfactum.com"
  organization_name = "panfactum"
  root_email        = "jack@panfactum.com"
}

skip = true