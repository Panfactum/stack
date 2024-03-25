include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_secrets_csi"
}

dependency "cluster" {
  config_path = "../aws_eks"
}

inputs = {
  pull_through_cache_enabled = true
  eks_cluster_name           = dependency.cluster.outputs.cluster_name
  vpa_enabled                = true
}
