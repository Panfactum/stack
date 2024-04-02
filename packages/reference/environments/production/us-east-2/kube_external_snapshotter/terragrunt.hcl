include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "../../../../../terraform//kube_external_snapshotter"
  #source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_external_snapshotter"
}

dependency "cluster" {
  config_path  = "../aws_eks"
  skip_outputs = true
}

inputs = {
  pull_through_cache_enabled = true
  vpa_enabled                = true
}
