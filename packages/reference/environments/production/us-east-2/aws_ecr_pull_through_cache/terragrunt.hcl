include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//aws_ecr_pull_through_cache"
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
