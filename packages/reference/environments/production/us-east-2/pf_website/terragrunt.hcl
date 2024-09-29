include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.source
}

dependency "ingress" {
  config_path  = "../kube_ingress_nginx"
  skip_outputs = true
}

inputs = {
  website_domain         = "panfactum.com"
  website_image_version  = run_cmd("--terragrunt-quiet", "pf-get-version-hash", "main", "https://github.com/panfactum/stack")
  algolia_app_id         = "VJ9GF38NJX"
  algolia_search_api_key = "80b37f3070653c20bf4eac2e362b0dbb"
  algolia_index_name     = "docs"
}