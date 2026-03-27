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


