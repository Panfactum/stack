terraform {
  required_providers {
    pf = {
      source = "panfactum/pf"
    }
  }
}

locals {
  name = "demo-tracker-service"
  namespace = module.namespace.namespace
  port = 3000
}

module "namespace" {
  source =   "${var.pf_module_source}kube_namespace${var.pf_module_ref}"
  namespace = local.name
}

module "database" {
  source = "${var.pf_module_source}kube_pg_cluster${var.pf_module_ref}"

  pg_cluster_namespace                 = local.namespace
  aws_iam_ip_allow_list                = []

  pg_initial_storage_gb                = 5    # for the purposes of the demo
  pg_max_connections                   = 20   # for the purposes of the demo
  pg_instances                         = 2    # for the purposes of the demo
  burstable_nodes_enabled              = true # for the purposes of the demo

  pull_through_cache_enabled           = var.pull_through_cache_enabled
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
}

module "demo_tracker_service_deployment" {
  source = "${var.pf_module_source}kube_deployment${var.pf_module_ref}"
  namespace = module.namespace.namespace
  name      = local.name

  replicas                             = 2

  common_env = {
    PORT     = local.port
    DB_HOST  = module.database.pooler_rw_service_name
    DB_PORT  = module.database.pooler_rw_service_port
    DB_NAME  = var.db_name
    DB_SCHEMA = var.db_schema
    TOKEN_VALIDATION_URL = var.token_validation_url
  }

  common_env_from_secrets = {
    DB_USER = {
      secret_name = module.database.superuser_creds_secret
      key = "username"
    }

    DB_PASSWORD = {
      secret_name = module.database.superuser_creds_secret
      key = "password"
    }
  }

  containers = [
    {
      name    = "demo-tracker-service"
      image_registry   = "891377197483.dkr.ecr.us-east-2.amazonaws.com"
      image_repository = "demo-tracker-service"
      image_tag = var.image_version
      command = []
      liveness_probe_type  = "HTTP"
      liveness_probe_port  = local.port
      liveness_probe_route = var.healthcheck_route
      minimum_memory = 100
      ports = {
        http ={
          port = local.port
        }
      }
    }
  ]

  vpa_enabled = var.vpa_enabled
  controller_nodes_enabled = true

  depends_on = [module.database]
}

module "ingress" {
  source = "${var.pf_module_source}kube_ingress${var.pf_module_ref}"

  name      = local.name
  namespace = local.namespace

  domains      = [var.domain]
  ingress_configs = [{
    path_prefix = "/tracker"
    remove_prefix = true
    service      = local.name
    service_port = local.port
  }]

  cdn_mode_enabled = false
  cors_enabled                   = true
  cross_origin_embedder_policy   = "credentialless"
  csp_enabled                    = true
  cross_origin_isolation_enabled = true
  rate_limiting_enabled          = true
  permissions_policy_enabled     = true

  depends_on = [module.demo_tracker_service_deployment]
}