include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cluster" {
  config_path  = "../aws_eks"
  skip_outputs = true
}

dependency "kyverno" {
  config_path  = "../kube_kyverno"
  skip_outputs = true
}

inputs = {}
