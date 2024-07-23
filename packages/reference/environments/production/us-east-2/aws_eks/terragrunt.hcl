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

  cluster_name        = "production-primary"
  cluster_description = "The primary production kubernetes cluster"

  control_plane_subnets = [
    "PUBLIC_A",
    "PUBLIC_B",
    "PUBLIC_C"
  ]
  control_plane_logging = []
  service_cidr          = "172.20.0.0/16"
  dns_service_ip        = "172.20.0.10"

  bootstrap_mode_enabled = false # Set this to true when you are completing the bootstrap guide
  node_subnets = [
    "PRIVATE_A",
    "PRIVATE_B",
    "PRIVATE_C"
  ]
}
