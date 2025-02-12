include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}


locals {
  secrets = yamldecode(sops_decrypt_file("${get_terragrunt_dir()}/secrets.yaml"))
}

inputs = {
  docker_hub_username     = "panfactum"
  docker_hub_access_token = local.secrets.docker_hub_access_token
  github_username         = "fullykubed"
  github_access_token     = local.secrets.github_access_token
}