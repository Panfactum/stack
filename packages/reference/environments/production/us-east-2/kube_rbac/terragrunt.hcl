include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cluster" {
  config_path = "../aws_eks"
}

inputs = {
  aws_node_role_arn = dependency.cluster.outputs.node_role_arn
}
