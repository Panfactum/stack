include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  name        = "sops-${include.panfactum.locals.vars.environment}"
  description = "Encryption key for sops"
}
