include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "snapshotter" {
  config_path  = "../kube_external_snapshotter"
  skip_outputs = true
}

inputs = {}