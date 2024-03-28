include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_aws_lb_controller"
}

dependency "aws_eks" {
  config_path = "../aws_eks"
}

dependency "aws_vpc" {
  config_path = "../aws_vpc"
}

inputs = {
  eks_cluster_name = dependency.aws_eks.outputs.cluster_name
  vpc_id           = dependency.aws_vpc.outputs.vpc_id
  subnets = [
    "PUBLIC_A",
    "PUBLIC_B",
    "PUBLIC_C"
  ]

  pull_through_cache_enabled = true
  vpa_enabled                = true
}


