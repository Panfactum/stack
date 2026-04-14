/***************************************
* PostgreSQL Database
***************************************/

module "database" {
  source = "../kube_pg_cluster"

  pg_cluster_namespace      = local.namespace
  pg_instances              = var.pg_instances
  pg_initial_storage_gb     = var.pg_initial_storage_gb
  pg_smart_shutdown_timeout = 1
  pg_minimum_memory_mb      = var.pg_minimum_memory_mb
  pg_maximum_memory_mb      = var.pg_maximum_memory_mb
  pg_minimum_cpu_millicores = var.pg_minimum_cpu_millicores
  pg_maximum_cpu_millicores = var.pg_maximum_cpu_millicores
  pg_storage_limit_gb       = var.pg_storage_limit_gb
  extra_schemas             = ["temporal", "temporal_visibility"]

  aws_iam_ip_allow_list                = var.aws_iam_ip_allow_list
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  controller_nodes_enabled             = false
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = data.pf_metadata.metadata.sla_target == 3
  monitoring_enabled                   = var.monitoring_enabled
  vpa_enabled                          = var.vpa_enabled
  voluntary_disruptions_enabled        = var.voluntary_disruptions_enabled
  voluntary_disruption_window_enabled  = var.voluntary_disruption_window_enabled
  voluntary_disruption_window_seconds  = var.voluntary_disruption_window_seconds
}

/***************************************
* Schema Initialization
***************************************/

module "schema_init" {
  source = "../kube_job"

  name      = "${local.name}-schema-init"
  namespace = local.namespace

  containers = [
    {
      name             = "schema-init"
      image_registry   = "index.docker.io"
      image_repository = "temporalio/admin-tools"
      image_tag        = "1.26.2"
      command          = ["/bin/sh", "/scripts/schema-init.sh"]
      minimum_memory   = 256
      minimum_cpu      = 50
    }
  ]

  common_env = {
    DB_HOST = "${split(".", module.database.rw_service_name)[0]}.${local.namespace}.svc.cluster.local"
    DB_PORT = tostring(module.database.rw_service_port)
  }

  common_env_from_secrets = {
    DB_USER = {
      secret_name = module.database.superuser_creds_secret
      key         = "username"
    }
    DB_PASSWORD = {
      secret_name = module.database.superuser_creds_secret
      key         = "password"
    }
  }

  config_map_mounts = {
    "${kubernetes_config_map_v1.scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }

  active_deadline_seconds = 300
  backoff_limit           = 3
  wait_for_success        = true
  linkerd_enabled         = false

  pull_through_cache_enabled  = var.pull_through_cache_enabled
  burstable_nodes_enabled     = var.burstable_nodes_enabled
  spot_nodes_enabled          = var.spot_nodes_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled

  depends_on = [module.database]
}
