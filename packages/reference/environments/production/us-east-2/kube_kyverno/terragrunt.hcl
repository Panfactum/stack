include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "aws_eks" {
  config_path  = "../aws_eks"
  skip_outputs = true
}

inputs = {}


