include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  vpc_name        = "PRODUCTION_PRIMARY"
  vpc_description = "VPC for the primary production environment."
}
