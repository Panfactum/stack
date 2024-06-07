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

inputs = {
  # Only set to true if you have deployed kube_monitoring. Otherwise, leave false.
  prometheus_enabled = true
}
