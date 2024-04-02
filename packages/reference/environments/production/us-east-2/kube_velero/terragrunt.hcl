include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_velero"
}

dependency "cluster" {
  config_path = "../aws_eks"
}

inputs = {
  eks_cluster_name           = dependency.cluster.outputs.cluster_name
  pull_through_cache_enabled = true
  vpa_enabled                = true
}