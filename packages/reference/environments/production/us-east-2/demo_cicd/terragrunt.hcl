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

dependency "buildkit" {
  config_path = "../kube_buildkit"
}

dependency "module_bucket" {
  config_path = "../pf_modules_site"
}

inputs = {
  github_username           = "fullykubed"
  github_token              = local.secrets.github_token
  authentik_token           = local.secrets.authentik_token
  webhook_domain            = "cicd.prod.panfactum.com"
  buildkit_bucket_name      = dependency.buildkit.outputs.cache_bucket_name
  buildkit_bucket_region    = dependency.buildkit.outputs.cache_bucket_region
  algolia_app_id            = "VJ9GF38NJX"
  algolia_api_key           = local.secrets.algolia_api_key
  algolia_search_api_key    = "76e7c17dae4d35f581c858ee2784b41a"
  algolia_index_name        = "docs"
  algolia_index_name_2      = "docs-2"
  mongodb_atlas_public_key  = local.secrets.mongodb_atlas_public_key
  mongodb_atlas_private_key = local.secrets.mongodb_atlas_private_key
  site_url                  = "https://panfactum.com"
  scraper_image_version     = "586d06cee96633a26ffe0ce318d85f26c3f7c27d"
  module_bucket             = dependency.module_bucket.outputs.bucket_name
}

skip = get_env("CI", "false") == "true"



