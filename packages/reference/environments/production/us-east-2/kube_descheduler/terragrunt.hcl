include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_descheduler"
}

dependency "linkerd" {
  config_path  = "../kube_linkerd"
  skip_outputs = true
}

inputs = {
  pull_through_cache_enabled = true
  vpa_enabled                = true
}
