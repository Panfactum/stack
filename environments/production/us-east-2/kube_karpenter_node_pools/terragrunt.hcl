include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "karpenter" {
  config_path  = "../kube_karpenter"
  skip_outputs = true
}

dependency "cluster" {
  config_path = "../aws_eks"
}

dependency "vpc" {
  config_path = "../aws_vpc"
}

inputs = {
  cluster_name           = dependency.cluster.outputs.cluster_name
  cluster_endpoint       = dependency.cluster.outputs.cluster_url
  cluster_dns_service_ip = dependency.cluster.outputs.dns_service_ip
  cluster_ca_data        = dependency.cluster.outputs.cluster_ca_data
  node_instance_profile  = dependency.cluster.outputs.node_instance_profile
  node_vpc_id            = dependency.vpc.outputs.vpc_id
  node_security_group_id = dependency.cluster.outputs.node_security_group_id
  node_subnets = [
    "PRIVATE_A",
    "PRIVATE_B",
    "PRIVATE_C"
  ]
}
