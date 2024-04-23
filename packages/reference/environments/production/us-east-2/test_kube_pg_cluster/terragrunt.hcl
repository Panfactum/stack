include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cnpg" {
  config_path  = "../kube_cloudnative_pg"
  skip_outputs = true
}

dependency "cluster" {
  config_path = "../aws_eks"
}

inputs = {
  eks_cluster_name = dependency.cluster.outputs.cluster_name

  pull_through_cache_enabled = true
  vpa_enabled                = true
}

skip = true
