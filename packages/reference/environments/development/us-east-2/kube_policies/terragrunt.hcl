include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "kyverno" {
  config_path  = "../kube_kyverno"
  skip_outputs = true
}

inputs = {
  common_env = {
    james = "lee"
  }
  common_secrets = {
    jack = "langston"
  }
  common_pod_annotations = {
    panfactum = "rocks"
  }
}
