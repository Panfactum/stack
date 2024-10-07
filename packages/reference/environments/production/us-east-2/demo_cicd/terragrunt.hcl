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
  authentik_token        = local.secrets.authentik_token
  webhook_domain         = "cicd.prod.panfactum.com"
  buildkit_bucket_name   = dependency.buildkit.outputs.cache_bucket_name
  buildkit_bucket_region = dependency.buildkit.outputs.cache_bucket_region
  algolia_app_id         = "VJ9GF38NJX"
  algolia_api_key        = local.secrets.algolia_api_key
  algolia_search_api_key = "76e7c17dae4d35f581c858ee2784b41a"
  algolia_index_name     = "docs"
  scraper_image_version  = "684730eb4430cb0536d9874a9af908ec47f4372b"
}

skip = get_env("CI", "false") == "true"



