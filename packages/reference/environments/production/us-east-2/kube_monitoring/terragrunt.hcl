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

inputs = {
  eks_cluster_name = dependency.cluster.outputs.cluster_name

  grafana_domain = "grafana.prod.panfactum.com"

  pull_through_cache_enabled = true
  vpa_enabled                = true
  ingress_enabled            = true
}
