terraform {
  required_providers {
    pf = {
      source = "panfactum/pf"
    }
  }
}


module "namespace" {
  source    = "${var.pf_module_source}kube_namespace${var.pf_module_ref}"
  namespace = var.namespace
}

module "statefulset_service" {
  for_each  = var.statefulsets
  source    = "${var.pf_module_source}kube_stateful_set${var.pf_module_ref}"
  namespace = module.namespace.namespace
  name      = each.key

  replicas = 1

  common_env = each.value.env

  common_env_from_secrets = {}

  containers = [
    {
      name                 = each.key
      image_registry       = each.value.image_registry
      image_repository     = each.value.image_repository
      image_tag            = each.value.image_tag
      liveness_probe_type  = "HTTP"
      liveness_probe_port  = each.value.port
      liveness_probe_route = each.value.healthcheck_route
      minimum_memory       = each.value.minimum_memory
      ports = {
        http = {
          port = each.value.port
        }
      }
      command = []

      read_only = false
    }
  ]

  vpa_enabled              = var.vpa_enabled
  controller_nodes_enabled = true

  volume_mounts = {
    "n8n-data" = {
      storage_class              = each.value.storage_class
      initial_size_gb            = each.value.storage_initial_gb
      size_limit_gb              = each.value.storage_limit_gb
      increase_gb                = each.value.storage_increase_gb
      increase_threshold_percent = each.value.storage_increase_threshold_percent
      mount_path                 = each.value.mount_path
      backups_enabled            = each.value.backups_enabled
    }
  }
}

module "ingress" {
  source   = "${var.pf_module_source}kube_ingress${var.pf_module_ref}"
  for_each = var.statefulsets

  name      = each.key
  namespace = var.namespace

  domains = each.value.domains
  ingress_configs = [
    {
      path_prefix   = "/"
      remove_prefix = false
      service       = each.key
      service_port  = each.value.port
    }
  ]

  cdn_mode_enabled               = each.value.cdn_mode_enabled
  cors_enabled                   = each.value.cors_enabled
  cross_origin_embedder_policy   = each.value.cross_origin_embedder_policy
  csp_enabled                    = each.value.csp_enabled
  cross_origin_isolation_enabled = each.value.cross_origin_isolation_enabled
  rate_limiting_enabled          = each.value.rate_limiting_enabled
  permissions_policy_enabled     = each.value.permissions_policy_enabled

  depends_on = [module.statefulset_service]
}