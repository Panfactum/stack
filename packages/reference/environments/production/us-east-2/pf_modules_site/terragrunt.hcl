include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  bucket_name  = "pf-modules-website"
  description  = "Hosts the IaC modules and submodules for the Panfactum Stack"
  domains      = ["modules.panfactum.com"]
  default_file = ""
}