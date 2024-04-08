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

inputs = {
  cluster_name          = dependency.cluster.outputs.cluster_name
  cluster_endpoint      = dependency.cluster.outputs.cluster_url
  cluster_ca_data       = dependency.cluster.outputs.cluster_ca_data
  node_instance_profile = dependency.cluster.outputs.node_instance_profile
}
