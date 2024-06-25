include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.source
}

locals {
  secrets = yamldecode(sops_decrypt_file("${get_terragrunt_dir()}/secrets.yaml"))
}

dependency "cluster" {
  config_path = "../aws_eks"
}

dependency "buildkit" {
  config_path = "../kube_buildkit"
}

inputs = {
  eks_cluster_name       = dependency.cluster.outputs.cluster_name
  github_username        = "fullykubed"
  github_token           = local.secrets.github_token
  authentik_token = local.secrets.authentik_token
  webhook_domain         = "cicd.prod.panfactum.com"
  buildkit_bucket_name   = dependency.buildkit.outputs.cache_bucket_name
  buildkit_bucket_region = dependency.buildkit.outputs.cache_bucket_region
}

skip = get_env("CI", "false") == "true"



