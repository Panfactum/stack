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
  extra_storage_classes = {
    example = {
      type        = "io2"
      iops_per_gb = 1000
    }
  }
}
