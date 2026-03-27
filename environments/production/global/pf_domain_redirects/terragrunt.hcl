include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.source
}

dependency "registered_domains" {
  config_path  = "../aws_registered_domains"
  skip_outputs = true
}

inputs = {
  domains = ["getpanfactum.com", "trypanfactum.com", "panfactum.io"]
}