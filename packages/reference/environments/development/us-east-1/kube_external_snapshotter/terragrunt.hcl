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
dependency "aws_ebs_csi" {
  config_path  = "../kube_aws_ebs_csi"
  skip_outputs = true
}

inputs = {}