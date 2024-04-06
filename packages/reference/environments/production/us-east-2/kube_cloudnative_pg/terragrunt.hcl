include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_cloudnative_pg"
}

dependency "linkerd" {
  config_path  = "../kube_linkerd"
  skip_outputs = true
}

inputs = {
  log_level                  = "info"
  pull_through_cache_enabled = true
  vpa_enabled                = true
}