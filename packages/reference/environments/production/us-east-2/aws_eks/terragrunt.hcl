include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//aws_eks"
}

dependency "aws_vpc" {
  config_path  = "../aws_vpc"
  skip_outputs = true
}

dependency "pull_through_cache" {
  config_path  = "../aws_ecr_pull_through_cache"
  skip_outputs = true
}

inputs = {
  cluster_name        = "production-primary"
  cluster_description = "The primary production kubernetes cluster"

  control_plane_subnets = [
    "PUBLIC_A",
    "PUBLIC_B",
    "PUBLIC_C"
  ]
  control_plane_logging = []
  service_cidr          = "172.20.0.0/16"

  controller_node_count          = 3
  controller_node_instance_types = ["t3a.large"]
  controller_node_subnets = [
    "PRIVATE_A",
    "PRIVATE_B",
    "PRIVATE_C"
  ]
}
