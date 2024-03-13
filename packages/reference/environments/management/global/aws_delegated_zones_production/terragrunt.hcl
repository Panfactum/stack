include "panfactum" {
  path = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//aws_delegated_zones"
}

dependency "root_domains" {
  config_path = "../aws_registered_domains"
}

inputs = {
  root_domain_names = keys(dependency.root_domains.outputs.domains)
  subdomain_identifiers = ["prod", "production"]
}
