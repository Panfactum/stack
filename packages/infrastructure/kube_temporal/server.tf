/***************************************
* Temporal Server Deployments
***************************************/

locals {
  frontend_replicas = var.frontend_replicas != null ? var.frontend_replicas : (data.pf_metadata.metadata.sla_target >= 2 ? 2 : 1)
  history_replicas  = var.history_replicas != null ? var.history_replicas : (data.pf_metadata.metadata.sla_target >= 2 ? 2 : 1)
  matching_replicas = var.matching_replicas != null ? var.matching_replicas : (data.pf_metadata.metadata.sla_target >= 2 ? 2 : 1)
  worker_replicas   = var.worker_replicas != null ? var.worker_replicas : (data.pf_metadata.metadata.sla_target >= 2 ? 2 : 1)
}

module "frontend" {
  source = "../kube_deployment"

  name         = "${local.name}-frontend"
  namespace    = local.namespace
  replicas     = local.frontend_replicas
  service_name = "temporal-frontend"

  # Scheduling
  az_spread_preferred                  = data.pf_metadata.metadata.sla_target >= 2
  instance_type_anti_affinity_required = data.pf_metadata.metadata.sla_target == 3
  host_anti_affinity_required          = local.frontend_replicas >= 2
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled

  # Config rendering init container + main container
  containers = [
    {
      name             = "config-renderer"
      init             = true
      image_registry   = "index.docker.io"
      image_repository = "library/busybox"
      image_tag        = "1.36"
      command          = ["/bin/sh", "/scripts/render-config.sh"]
      minimum_memory   = 32
      minimum_cpu      = 10
      read_only        = false
    },
    {
      name             = "frontend"
      init             = false
      image_registry   = "index.docker.io"
      image_repository = "temporalio/server"
      image_tag        = "1.26.3"
      command          = ["temporal-server", "start", "--service", "frontend"]
      ports = {
        grpc = {
          port              = 7233
          service_port      = 7233
          protocol          = "TCP"
          expose_on_service = true
        }
        membership = {
          port              = 6933
          protocol          = "TCP"
          expose_on_service = false
        }
      }
      minimum_memory = 512
      minimum_cpu    = 100
      read_only      = false
    }
  ]

  common_env = {
    TEMPORAL_ROOT        = "/etc/temporal"
    TEMPORAL_CONFIG_DIR  = "config"
    TEMPORAL_ENVIRONMENT = "config"
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
    "${local.name}-scripts" = {
      mount_path = "/scripts"
      optional   = false
    }
    "${local.name}-config-template" = {
      mount_path = "/etc/temporal/config-template"
      optional   = false
    }
    "${local.name}-dynamic-config" = {
      mount_path = "/etc/temporal/dynamic_config"
      optional   = false
    }
  }

  # emptyDir for rendered config
  tmp_directories = {
    "temporal-config" = {
      mount_path = "/etc/temporal/config"
      size_mb    = 5
    }
  }

  wait_for_rollout                    = true
  vpa_enabled                         = var.vpa_enabled
  voluntary_disruptions_enabled       = var.voluntary_disruptions_enabled
  voluntary_disruption_window_enabled = var.voluntary_disruption_window_enabled
  voluntary_disruption_window_seconds = var.voluntary_disruption_window_seconds

  depends_on = [module.schema_init]
}

module "history" {
  source = "../kube_deployment"

  name         = "${local.name}-history"
  namespace    = local.namespace
  replicas     = local.history_replicas
  service_name = "temporal-history"

  # Scheduling
  az_spread_preferred                  = data.pf_metadata.metadata.sla_target >= 2
  instance_type_anti_affinity_required = data.pf_metadata.metadata.sla_target == 3
  host_anti_affinity_required          = local.history_replicas >= 2
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled

  # Config rendering init container + main container
  containers = [
    {
      name             = "config-renderer"
      init             = true
      image_registry   = "index.docker.io"
      image_repository = "library/busybox"
      image_tag        = "1.36"
      command          = ["/bin/sh", "/scripts/render-config.sh"]
      minimum_memory   = 32
      minimum_cpu      = 10
      read_only        = false
    },
    {
      name             = "history"
      init             = false
      image_registry   = "index.docker.io"
      image_repository = "temporalio/server"
      image_tag        = "1.26.3"
      command          = ["temporal-server", "start", "--service", "history"]
      ports = {
        grpc = {
          port              = 7234
          service_port      = 7234
          protocol          = "TCP"
          expose_on_service = true
        }
        membership = {
          port              = 6934
          protocol          = "TCP"
          expose_on_service = false
        }
      }
      minimum_memory = 512
      minimum_cpu    = 100
      read_only      = false
    }
  ]

  common_env = {
    TEMPORAL_ROOT        = "/etc/temporal"
    TEMPORAL_CONFIG_DIR  = "config"
    TEMPORAL_ENVIRONMENT = "config"
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
    "${local.name}-scripts" = {
      mount_path = "/scripts"
      optional   = false
    }
    "${local.name}-config-template" = {
      mount_path = "/etc/temporal/config-template"
      optional   = false
    }
    "${local.name}-dynamic-config" = {
      mount_path = "/etc/temporal/dynamic_config"
      optional   = false
    }
  }

  # emptyDir for rendered config
  tmp_directories = {
    "temporal-config" = {
      mount_path = "/etc/temporal/config"
      size_mb    = 5
    }
  }

  vpa_enabled                         = var.vpa_enabled
  voluntary_disruptions_enabled       = var.voluntary_disruptions_enabled
  voluntary_disruption_window_enabled = var.voluntary_disruption_window_enabled
  voluntary_disruption_window_seconds = var.voluntary_disruption_window_seconds

  depends_on = [module.schema_init]
}

module "matching" {
  source = "../kube_deployment"

  name         = "${local.name}-matching"
  namespace    = local.namespace
  replicas     = local.matching_replicas
  service_name = "temporal-matching"

  # Scheduling
  az_spread_preferred                  = data.pf_metadata.metadata.sla_target >= 2
  instance_type_anti_affinity_required = data.pf_metadata.metadata.sla_target == 3
  host_anti_affinity_required          = local.matching_replicas >= 2
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled

  # Config rendering init container + main container
  containers = [
    {
      name             = "config-renderer"
      init             = true
      image_registry   = "index.docker.io"
      image_repository = "library/busybox"
      image_tag        = "1.36"
      command          = ["/bin/sh", "/scripts/render-config.sh"]
      minimum_memory   = 32
      minimum_cpu      = 10
      read_only        = false
    },
    {
      name             = "matching"
      init             = false
      image_registry   = "index.docker.io"
      image_repository = "temporalio/server"
      image_tag        = "1.26.3"
      command          = ["temporal-server", "start", "--service", "matching"]
      ports = {
        grpc = {
          port              = 7235
          service_port      = 7235
          protocol          = "TCP"
          expose_on_service = true
        }
        membership = {
          port              = 6935
          protocol          = "TCP"
          expose_on_service = false
        }
      }
      minimum_memory = 512
      minimum_cpu    = 100
      read_only      = false
    }
  ]

  common_env = {
    TEMPORAL_ROOT        = "/etc/temporal"
    TEMPORAL_CONFIG_DIR  = "config"
    TEMPORAL_ENVIRONMENT = "config"
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
    "${local.name}-scripts" = {
      mount_path = "/scripts"
      optional   = false
    }
    "${local.name}-config-template" = {
      mount_path = "/etc/temporal/config-template"
      optional   = false
    }
    "${local.name}-dynamic-config" = {
      mount_path = "/etc/temporal/dynamic_config"
      optional   = false
    }
  }

  # emptyDir for rendered config
  tmp_directories = {
    "temporal-config" = {
      mount_path = "/etc/temporal/config"
      size_mb    = 5
    }
  }

  vpa_enabled                         = var.vpa_enabled
  voluntary_disruptions_enabled       = var.voluntary_disruptions_enabled
  voluntary_disruption_window_enabled = var.voluntary_disruption_window_enabled
  voluntary_disruption_window_seconds = var.voluntary_disruption_window_seconds

  depends_on = [module.schema_init]
}

module "worker" {
  source = "../kube_deployment"

  name         = "${local.name}-worker"
  namespace    = local.namespace
  replicas     = local.worker_replicas
  service_name = "temporal-worker"

  # Scheduling
  az_spread_preferred                  = data.pf_metadata.metadata.sla_target >= 2
  instance_type_anti_affinity_required = data.pf_metadata.metadata.sla_target == 3
  host_anti_affinity_required          = local.worker_replicas >= 2
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled

  # Config rendering init container + main container
  containers = [
    {
      name             = "config-renderer"
      init             = true
      image_registry   = "index.docker.io"
      image_repository = "library/busybox"
      image_tag        = "1.36"
      command          = ["/bin/sh", "/scripts/render-config.sh"]
      minimum_memory   = 32
      minimum_cpu      = 10
      read_only        = false
    },
    {
      name             = "worker"
      init             = false
      image_registry   = "index.docker.io"
      image_repository = "temporalio/server"
      image_tag        = "1.26.3"
      command          = ["temporal-server", "start", "--service", "worker"]
      ports = {
        grpc = {
          port              = 7239
          service_port      = 7239
          protocol          = "TCP"
          expose_on_service = true
        }
        membership = {
          port              = 6939
          protocol          = "TCP"
          expose_on_service = false
        }
      }
      minimum_memory = 512
      minimum_cpu    = 100
      read_only      = false
    }
  ]

  common_env = {
    TEMPORAL_ROOT        = "/etc/temporal"
    TEMPORAL_CONFIG_DIR  = "config"
    TEMPORAL_ENVIRONMENT = "config"
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
    "${local.name}-scripts" = {
      mount_path = "/scripts"
      optional   = false
    }
    "${local.name}-config-template" = {
      mount_path = "/etc/temporal/config-template"
      optional   = false
    }
    "${local.name}-dynamic-config" = {
      mount_path = "/etc/temporal/dynamic_config"
      optional   = false
    }
  }

  # emptyDir for rendered config
  tmp_directories = {
    "temporal-config" = {
      mount_path = "/etc/temporal/config"
      size_mb    = 5
    }
  }

  vpa_enabled                         = var.vpa_enabled
  voluntary_disruptions_enabled       = var.voluntary_disruptions_enabled
  voluntary_disruption_window_enabled = var.voluntary_disruption_window_enabled
  voluntary_disruption_window_seconds = var.voluntary_disruption_window_seconds

  depends_on = [module.schema_init]
}

/***************************************
* Namespace Initialization
***************************************/

module "namespace_init" {
  source = "../kube_job"

  name      = "${local.name}-namespace-init"
  namespace = local.namespace

  containers = [
    {
      name             = "namespace-init"
      image_registry   = "index.docker.io"
      image_repository = "temporalio/admin-tools"
      image_tag        = "1.26.2"
      command          = ["/bin/sh", "/scripts/namespace-init.sh"]
      minimum_memory   = 256
      minimum_cpu      = 50
    }
  ]

  common_env = {
    TEMPORAL_ADDRESS = "temporal-frontend.${local.namespace}.svc.cluster.local:7233"
    RETENTION_DAYS   = tostring(var.default_namespace_retention_days)
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

  depends_on = [module.frontend]
}
