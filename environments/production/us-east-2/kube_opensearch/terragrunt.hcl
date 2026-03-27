include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  namespace = "default"
  dashboard_enabled = true
  dashboard_domain = "opensearch.prod.panfactum.com"
}
