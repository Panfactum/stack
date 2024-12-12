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

dependency "cluster" {
  config_path = "../aws_eks"
}

dependency "redis_cache" {
  config_path = "../demo_redis_cache"
}

inputs = {
  namespace = "demo-user-service"

  domain            = "demo.panfactum.com"
  image_version     = run_cmd("--terragrunt-quiet", "pf-get-commit-hash", "--ref=main", "--repo=https://github.com/panfactum/stack")
  healthcheck_route = "/health"
  db_name           = "postgres"
  db_schema         = "app"
  secret            = "secret"

  redis_master_set         = dependency.redis_cache.outputs.master_set
  redis_cache_creds_secret = dependency.redis_cache.outputs.superuser_creds_secret

  redis_cache_sentinel_enabled = true
  redis_cache_sentinel_host    = dependency.redis_cache.outputs.sentinel_host
  redis_cache_sentinel_port    = dependency.redis_cache.outputs.sentinel_port
}