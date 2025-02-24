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
  cluster_name  = dependency.cluster.outputs.cluster_name
  node_role_arn = dependency.cluster.outputs.node_role_arn

  # IMPORTANT: You must set this to `false` during the initial install process.
  wait = true
}