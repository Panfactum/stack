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
  eks_cluster_name       = dependency.cluster.outputs.cluster_name
  namespace = "demo-user-service"

  domain        = "demo.panfactum.com"
  image_version = run_cmd("--terragrunt-quiet", "pf-get-commit-hash", "--ref=main", "--repo=https://github.com/panfactum/stack")
  healthcheck_route = "/health"
  db_name = "postgres"
  db_schema = "app"
  secret = "secret"

  redis_cache_host = dependency.redis_cache.outputs.sentinel_host
  redis_cache_port = dependency.redis_cache.outputs.sentinel_port
  redis_master_set = dependency.redis_cache.outputs.master_set
  redis_cache_admin_role = dependency.redis_cache.outputs.admin_role
  redis_cache_admin_creds_secret = dependency.redis_cache.outputs.admin_creds_secret
}