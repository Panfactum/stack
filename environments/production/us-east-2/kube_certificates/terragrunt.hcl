include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "vault_core" {
  config_path  = "../vault_core_resources"
  skip_outputs = true
}

inputs = {
  alert_email        = "it@panfactum.com"
}