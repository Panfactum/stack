terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    aws = {
      source                = "hashicorp/aws"
      version               = "5.80.0"
      configuration_aliases = [aws.global]
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  name      = "nocodb"
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_nocodb"
}

data "aws_region" "current" {}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = var.namespace
}

/***************************************
* Database Backend
***************************************/

module "database" {
  source = "../kube_pg_cluster"

  pg_cluster_namespace                 = local.namespace
  pg_initial_storage_gb                = 10
  pg_instances                         = var.sla_target >= 2 ? 2 : 1
  pg_smart_shutdown_timeout            = 1
  pg_minimum_memory_mb                 = 500
  aws_iam_ip_allow_list                = var.aws_iam_ip_allow_list
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.sla_target == 3

  pg_recovery_mode_enabled = var.db_recovery_mode_enabled
  pg_recovery_directory    = var.db_recovery_directory
  pg_recovery_target_time  = var.db_recovery_target_time
}


/***************************************
* Redis Backend
***************************************/

module "redis" {
  source = "../kube_redis_sentinel"

  namespace                            = local.namespace
  replica_count                        = 3
  lfu_cache_enabled                    = true // NocoDB uses this as a cache
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  vpa_enabled                          = var.vpa_enabled
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = false // Not needed; a small chance of disruption is entirely fine
  disabled_commands                    = []    // NocoDB uses flushdb
}

/***************************************
* S3 Bucket
***************************************/

resource "random_id" "bucket_name" {
  byte_length = 8
  prefix      = "nocodb-"
}

module "s3_bucket" {
  source = "../aws_s3_private_bucket"

  bucket_name                     = random_id.bucket_name.hex
  description                     = "Storage for NocoDB"
  versioning_enabled              = true
  audit_log_enabled               = false
  intelligent_transitions_enabled = true
}


/***************************************
* SMTP - TODO
***************************************/


/***************************************
* AWS Permissions
***************************************/


/***************************************
* Deployment
***************************************/

// This should never change
resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

// TODO: Auto-rotate
resource "random_password" "superuser_password" {
  length  = 64
  special = false
}

resource "kubernetes_secret" "config" {
  metadata {
    name      = "nocodb-config"
    labels    = data.pf_kube_labels.labels.labels
    namespace = local.namespace
  }
  data = {
    jwt-secret     = random_password.jwt_secret.result
    admin-password = random_password.superuser_password.result
  }
}

module "nocodb" {
  source                               = "../kube_deployment"
  namespace                            = local.namespace
  name                                 = local.name
  replicas                             = 2
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  instance_type_anti_affinity_required = var.sla_target == 3
  az_spread_preferred                  = var.sla_target >= 2
  host_anti_affinity_required          = var.sla_target >= 2
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  max_surge                            = "0%"
  containers = [
    {
      name             = "nocodb"
      image_registry   = "docker.io"
      image_repository = "nocodb/nocodb"
      image_tag        = var.nocodb_version
      command = [
        "/usr/src/appEntry/start.sh"
      ]
      liveness_probe_port  = "8080"
      liveness_probe_type  = "HTTP"
      liveness_probe_route = "/"
      minimum_memory       = 200
      ports = {
        http = {
          port     = 8080
          protocol = "TCP"
        }
      }
    }
  ]

  // TODO: Node Options
  // TODO: Telemetry Options
  // TODO: Log level

  common_env = {
    NC_DB                      = "pg://${module.database.rw_service_name}:${module.database.rw_service_port}?u=$(PG_USERNAME)&p=$(PG_PASSWORD)&d=${module.database.database}"
    NC_REDIS_URL               = "redis://$(REDIS_USERNAME):$(REDIS_PASSWORD)@${module.redis.redis_master_host}:${module.redis.redis_port}/2"
    NC_ADMIN_EMAIL             = var.superuser_email
    NC_JWT_EXPIRES_IN          = "${var.auth_expires_hours}h"
    NC_S3_BUCKET_NAME          = module.s3_bucket.bucket_name
    NC_S3_REGION               = data.aws_region.current.name
    NC_ATTACHMENT_FIELD_SIZE   = tostring(var.attachment_max_size_mb * 1024 * 1024)
    NC_MAX_ATTACHMENTS_ALLOWED = tostring(var.attachment_max_allowed)
    NC_SECURE_ATTACHMENTS      = tostring(var.secure_attachments_enabled)
  }

  common_env_from_secrets = {
    PG_USERNAME = {
      secret_name = module.database.superuser_creds_secret
      key         = "username"
    }
    PG_PASSWORD = {
      secret_name = module.database.superuser_creds_secret
      key         = "password"
    }
    REDIS_USERNAME = {
      secret_name = module.redis.superuser_creds_secret
      key         = "username"
    }
    REDIS_PASSWORD = {
      secret_name = module.redis.superuser_creds_secret
      key         = "password"
    }
    NC_AUTH_JWT_SECRET = {
      secret_name = kubernetes_secret.config.metadata[0].name
      key         = "jwt-secret"
    }
    NC_ADMIN_PASSWORD = {
      secret_name = kubernetes_secret.config.metadata[0].name
      key         = "admin-password"
    }
  }

  tmp_directories = {
    config = {
      mount_path = "/usr/app"
    }
  }

  vpa_enabled = var.vpa_enabled

  depends_on = [
    module.database,
    module.redis
  ]
}

/***************************************
* Ingress
***************************************/

module "ingress" {
  count     = var.ingress_enabled ? 1 : 0
  source    = "../kube_ingress"
  namespace = local.namespace
  name      = "nocodb"
  domains   = [var.domain]
  ingress_configs = [{
    service      = module.nocodb.service_name
    service_port = 8080

    cdn = {
      // By default we should not cache requests
      // because they main contain sensitive information
      default_cache_behavior = {
        caching_enabled = false
      }
    }
  }]
  cdn_mode_enabled               = var.cdn_mode_enabled
  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = true
  permissions_policy_enabled     = true
  csp_enabled                    = true
  cross_origin_opener_policy     = "same-origin-allow-popups" // Required for SSO login pop-ups

  // TODO: Open issue as this is unsafe but NocoDB will not run without
  // these relaxed security rules
  csp_style_src  = "'self' 'unsafe-inline'"
  csp_script_src = "'self' 'unsafe-inline' 'unsafe-eval'"
  csp_img_src    = "'self' data:"

  depends_on = [module.nocodb]
}

module "cdn" {
  count  = var.ingress_enabled && var.cdn_mode_enabled ? 1 : 0
  source = "../kube_aws_cdn"
  providers = {
    aws.global = aws.global
  }

  name           = "nocodb"
  origin_configs = module.ingress[0].cdn_origin_configs
}
