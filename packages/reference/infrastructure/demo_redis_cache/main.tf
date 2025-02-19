terraform {
  required_providers {
    pf = {
      source = "panfactum/pf"
    }
  }
}

locals {
  name      = "demo-redis-cache"
  namespace = module.namespace.namespace
}

module "constants" {
  source = "${var.pf_module_source}kube_constants${var.pf_module_ref}"
}

module "namespace" {
  source = "${var.pf_module_source}kube_namespace${var.pf_module_ref}"

  namespace = local.name
}

/***********************************************
* Redis
************************************************/

module "redis" {
  source = "${var.pf_module_source}kube_redis_sentinel${var.pf_module_ref}"

  namespace = module.namespace.namespace
  replica_count                 = 3
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  pull_through_cache_enabled    = var.pull_through_cache_enabled
  vpa_enabled                   = var.vpa_enabled
  monitoring_enabled            = var.monitoring_enabled
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled

  lfu_cache_enabled = true
  minimum_memory_mb = 100
}

module "kube_sync_secret_admin" {
    source = "${var.pf_module_source}kube_sync_secret${var.pf_module_ref}"

    destination_namespaces = var.redis_share_creds_secret_destinations
    excluded_namespaces    = []
    secret_name            = module.redis.admin_creds_secret
    secret_namespace       = module.namespace.namespace
}

module "kube_sync_secret_superuser" {
  source = "${var.pf_module_source}kube_sync_secret${var.pf_module_ref}"

  destination_namespaces = var.redis_share_creds_secret_destinations
  excluded_namespaces    = []
  secret_name            = module.redis.superuser_creds_secret
  secret_namespace       = module.namespace.namespace
}