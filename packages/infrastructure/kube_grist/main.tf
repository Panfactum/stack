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
  name      = "grist"
  namespace = module.namespace.namespace
  port      = 8484
}

data "pf_kube_labels" "labels" {
  module = "kube_grist"
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
  controller_nodes_enabled             = false // should not run on controller nodes which can cause disruptions
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.sla_target == 3

  pg_recovery_mode_enabled = var.db_recovery_mode_enabled
  pg_recovery_directory    = var.db_recovery_directory
  pg_recovery_target_time  = var.db_recovery_target_time

  pg_parameters = {
    jit = "off" // See https://support.getgrist.com/self-managed/#what-is-a-home-database
  }
}

/***************************************
* Redis Backend
***************************************/

module "redis" {
  source = "../kube_redis_sentinel"

  namespace                            = local.namespace
  replica_count                        = 3
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  vpa_enabled                          = var.vpa_enabled
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = false // Not needed; a small chance of disruption is entirely fine
}


/***************************************
* S3 Bucket
***************************************/

resource "random_id" "bucket_name" {
  byte_length = 8
  prefix      = "grist-"
}

module "s3_bucket" {
  source = "../aws_s3_private_bucket"

  bucket_name                     = random_id.bucket_name.hex
  description                     = "Storage for Grist"
  versioning_enabled              = true
  expire_old_versions             = true
  audit_log_enabled               = false
  intelligent_transitions_enabled = false
}

/***************************************
* AWS Permissions
***************************************/

resource "aws_iam_policy" "grist" {
  name_prefix = "grist-"
  policy      = data.aws_iam_policy_document.s3_access.json
}

data "aws_iam_policy_document" "s3_access" {
  statement {
    sid     = "s3Access"
    effect  = "Allow"
    actions = ["s3:*"]
    resources = [
      module.s3_bucket.bucket_arn,
      "${module.s3_bucket.bucket_arn}/*"
    ]
  }
}

module "user" {
  source = "../kube_aws_creds"

  iam_policy_json = data.aws_iam_policy_document.s3_access.json
  namespace       = var.namespace
}

/***************************************
* Vault IdP Setup
***************************************/

resource "vault_identity_oidc_key" "oidc" {
  name               = "grist"
  allowed_client_ids = ["*"]
  rotation_period    = var.session_max_length_hours * 60 * 60
  verification_ttl   = var.session_max_length_hours * 60 * 60 * 3
}

data "vault_identity_group" "rbac_groups" {
  // All groups can have access to Grist
  for_each = toset([
    "rbac-superusers",
    "rbac-admins",
    "rbac-readers",
    "rbac-restricted-readers"
  ])
  group_name = each.key
}

resource "vault_identity_oidc_assignment" "oidc" {
  name      = "grist"
  group_ids = [for group in data.vault_identity_group.rbac_groups : group.id]
}

resource "vault_identity_oidc_client" "oidc" {
  name = "grist"
  key  = vault_identity_oidc_key.oidc.name
  redirect_uris = [
    "https://${var.domain}/oauth2/callback",
  ]
  assignments = [
    vault_identity_oidc_assignment.oidc.name
  ]
  id_token_ttl     = var.session_max_length_hours * 60 * 60
  access_token_ttl = var.session_max_length_hours * 60 * 60
}

resource "vault_identity_oidc_provider" "oidc" {
  name = "grist"

  https_enabled = true
  issuer_host   = var.vault_domain
  allowed_client_ids = [
    vault_identity_oidc_client.oidc.client_id
  ]
  scopes_supported = [
    "profile"
  ]
}

/***************************************
* Deployment
***************************************/

resource "random_password" "session_secret" {
  length  = 64
  special = false
}

resource "random_integer" "disruption_minute_start" {
  min = 0
  max = 59
}

resource "kubernetes_secret" "config" {
  metadata {
    name      = "grist-config"
    labels    = data.pf_kube_labels.labels.labels
    namespace = local.namespace
  }
  data = {
    session-secret     = random_password.session_secret.result
    oidc-client-secret = vault_identity_oidc_client.oidc.client_secret
  }
}

resource "kubernetes_config_map" "entrypoint" {
  metadata {
    name      = "grist-entrypoint"
    labels    = data.pf_kube_labels.labels.labels
    namespace = local.namespace
  }
  data = {
    "entrypoint.sh" = file("${path.module}/entrypoint.sh")
  }
}

module "grist" {
  source = "../kube_deployment"

  namespace                            = local.namespace
  name                                 = local.name
  replicas                             = 1 // For realtime collaboration to work, there can only be a single instance running
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  instance_type_anti_affinity_required = false
  az_spread_preferred                  = false
  host_anti_affinity_required          = false
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  max_surge                            = "100%"
  max_unavailable                      = 0
  containers = [
    {
      name             = "grist"
      image_registry   = "docker.io"
      image_repository = "gristlabs/grist"
      image_tag        = var.grist_version
      command = [
        "/scripts/entrypoint.sh",
        "node",
        "/grist/sandbox/supervisor.mjs"
      ]
      liveness_probe_port  = tostring(local.port)
      liveness_probe_type  = "HTTP"
      liveness_probe_route = "/status"
      minimum_memory       = var.minimum_memory_mb
      ports = {
        http = {
          port     = local.port
          protocol = "TCP"
        }
      }
    }
  ]

  // TODO: Node Options

  common_env = merge(
    {
      // Root access settings
      GRIST_SINGLE_ORG    = lower(var.organization_name)
      GRIST_DEFAULT_EMAIL = var.root_email
      GRIST_SUPPORT_EMAIL = var.root_email
      GRIST_FORCE_LOGIN   = "true"

      // Basic Metadata
      APP_HOME_URL                   = "https://${var.domain}"
      PORT                           = tostring(local.port)
      GRIST_TELEMETRY_LEVEL          = var.telemetry_enabled ? "limited" : "off"
      GRIST_WIDGET_LIST_URL          = "https://github.com/gristlabs/grist-widget/releases/download/latest/manifest.json"
      COMMENTS                       = "true"
      GRIST_HIDE_UI_ELEMENTS         = join(",", var.hidden_ui_elements)
      GRIST_ACTION_HISTORY_MAX_ROWS  = tostring(var.action_history_max_rows)
      GRIST_ACTION_HISTORY_MAX_BYTES = tostring(var.action_history_max_gb * 1024 * 1024 * 1024)
      COOKIE_MAX_AGE                 = tostring(var.session_max_length_hours * 60 * 60 * 1000)

      // Database settings
      TYPEORM_TYPE     = "postgres"
      TYPEORM_DATABASE = module.database.database
      TYPEORM_HOST     = module.database.pooler_rw_service_name
      TYPEORM_PORT     = module.database.pooler_rw_service_port
      TYPEORM_EXTRA = jsonencode({
        poolSize = 100
      })

      // Cache settings
      REDIS_URL = "redis://:${module.redis.root_password}@${module.redis.redis_master_host}:${module.redis.redis_port}/2"

      // Docs storage
      GRIST_DOCS_MINIO_BUCKET        = module.s3_bucket.bucket_name
      GRIST_DOCS_MINIO_BUCKET_REGION = data.aws_region.current.name
      GRIST_DOCS_MINIO_ENDPOINT      = "s3.${data.aws_region.current.name}.amazonaws.com"

      // OIDC Settigns
      GRIST_OIDC_IDP_CLIENT_ID                 = vault_identity_oidc_client.oidc.client_id
      GRIST_OIDC_IDP_ISSUER                    = vault_identity_oidc_provider.oidc.issuer
      GRIST_OIDC_IDP_SKIP_END_SESSION_ENDPOINT = "true"
      GRIST_OIDC_IDP_SCOPES                    = "openid profile"
      GRIST_OIDC_SP_IGNORE_EMAIL_VERIFIED      = "true"
      GRIST_OIDC_SP_HOST                       = "https://${var.domain}"
      GRIST_OIDC_SP_HTTP_TIMEOUT               = tostring(5000)


      // Sandboxing is mostly unnecessary as already running in secure container;
      // Note that enabling Grist sandboxing _would_ increase security
      // but it comes with too many tradeoffs for us to consider supporting it at this time
      GRIST_SANDBOX_FLAVOR = "unsandboxed"
    },
    var.debug_logs_enabled ? { DEBUG = "true" } : {}
  )

  common_env_from_secrets = {
    TYPEORM_USERNAME = {
      secret_name = module.database.superuser_creds_secret
      key         = "username"
    }
    TYPEORM_PASSWORD = {
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
    GRIST_SESSION_SECRET = {
      secret_name = kubernetes_secret.config.metadata[0].name
      key         = "session-secret"
    }
    GRIST_DOCS_MINIO_ACCESS_KEY = {
      secret_name = module.user.creds_secret
      key         = "AWS_ACCESS_KEY_ID"
    }
    GRIST_DOCS_MINIO_SECRET_KEY = {
      secret_name = module.user.creds_secret
      key         = "AWS_SECRET_ACCESS_KEY"
    }
    GRIST_OIDC_IDP_CLIENT_SECRET = {
      secret_name = kubernetes_secret.config.metadata[0].name
      key         = "oidc-client-secret"
    }
  }

  tmp_directories = {
    config = {
      mount_path = "/persist"
    }
    tmp = {
      mount_path = "/tmp"
    }
  }

  config_map_mounts = {
    "${kubernetes_config_map.entrypoint.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }

  vpa_enabled = var.vpa_enabled

  // Every 4 hours, allow a 15 minute disruption to enable autoscaling and node re-balancing
  // Make the specific minute random, so that the disruptions windows in the cluster
  // are less likely to overlap
  // TODO: Implement https://openkruise.io/docs/user-manuals/cloneset#maxunavailable
  // so that this does cause downtime
  voluntary_disruption_window_enabled       = true
  voluntary_disruption_window_seconds       = 60 * 10
  voluntary_disruption_window_cron_schedule = "${random_integer.disruption_minute_start.result} 0/4 * * *"

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
  name      = "grist"
  domains   = [var.domain]
  ingress_configs = [{
    service      = module.grist.service_name
    service_port = local.port

    cdn = {
      // Don't cache by default b/c of dynamic API endpoints
      default_cache_behavior = {
        caching_enabled = false
      }

      path_match_behavior = {
        // Static assets can be cached
        "/v*" = {
          caching_enabled            = true
          cookies_in_cache_key       = []
          query_strings_in_cache_key = []
          min_ttl                    = 86400 // Needed to override the cache-control header set by the grist server
        }
      }
    }
  }]
  cdn_mode_enabled               = var.cdn_mode_enabled
  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = false // This must be disabled to allow widgets to load
  permissions_policy_enabled     = true
  csp_enabled                    = true

  // TODO: Open issue as this is unsafe but Grist will not run without
  // these relaxed security rules
  csp_style_src  = "'self' 'unsafe-inline'"
  csp_script_src = "'self' 'unsafe-inline'"
  csp_frame_src  = "'self' https://gristlabs.github.io/"

  depends_on = [module.grist]
}

module "cdn" {
  count  = var.ingress_enabled && var.cdn_mode_enabled ? 1 : 0
  source = "../kube_aws_cdn"
  providers = {
    aws.global = aws.global
  }

  name           = "grist"
  origin_configs = module.ingress[0].cdn_origin_configs

  geo_restriction_list = var.geo_restriction_list
  geo_restriction_type = var.geo_restriction_type
}
