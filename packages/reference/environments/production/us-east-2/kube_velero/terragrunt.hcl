include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cluster" {
  config_path = "../aws_eks"
}

dependency "snapshotter" {
  config_path  = "../kube_external_snapshotter"
  skip_outputs = true
}

inputs = {
  eks_cluster_name = dependency.cluster.outputs.cluster_name

  pull_through_cache_enabled = true
  vpa_enabled                = true

  # Alpha: Do not use
  monitoring_enabled = true
}