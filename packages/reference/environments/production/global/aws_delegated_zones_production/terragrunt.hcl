include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "root_domains" {
  config_path = "../aws_registered_domains"
}

inputs = {
  root_domain_names     = keys(dependency.root_domains.outputs.domains)
  subdomain_identifiers = ["prod", "production"]
}
