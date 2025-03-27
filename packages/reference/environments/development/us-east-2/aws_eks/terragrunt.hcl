include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "aws_vpc" {
  config_path = "../aws_vpc"
}

inputs = {
  vpc_id     = dependency.aws_vpc.outputs.vpc_id
  egress_ips = dependency.aws_vpc.outputs.nat_ips

  cluster_name        = "development-primary"
  cluster_description = "Panfactum Kubernetes cluster for the development environment"

  bootstrap_mode_enabled = true # Set this to true when you are completing the bootstrap guide
  node_subnets = [
    "PRIVATE_A"
  ]
}
