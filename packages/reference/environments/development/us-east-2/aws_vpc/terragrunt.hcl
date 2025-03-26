include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  vpc_name        = "DEVELOPMENT_PRIMARY"
  vpc_description = "Panfactum VPC for the development environment"
}
