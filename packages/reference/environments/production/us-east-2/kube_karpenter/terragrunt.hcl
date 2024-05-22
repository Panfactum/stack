include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "vpc" {
  config_path = "../aws_vpc"
}

dependency "cluster" {
  config_path = "../aws_eks"
}

inputs = {
  cluster_name           = dependency.cluster.outputs.cluster_name
  node_role_arn          = dependency.cluster.outputs.node_role_arn
  node_vpc_id            = dependency.vpc.outputs.vpc_id
  node_security_group_id = dependency.cluster.outputs.node_security_group_id
  node_subnets = [
    "PRIVATE_A",
    "PRIVATE_B",
    "PRIVATE_C"
  ]
  pull_through_cache_enabled = true
  vpa_enabled                = true

  # Alpha: Do not use
  monitoring_enabled = true
}
