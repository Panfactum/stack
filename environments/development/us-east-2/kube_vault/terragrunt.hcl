include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "ebs_csi" {
  config_path  = "../kube_aws_ebs_csi"
  skip_outputs = true
}

inputs = {}
