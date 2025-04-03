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
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
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
  name                    = "airbyte"
  namespace               = module.namespace.namespace
  memory_limit_multiplier = 1.3
}

data "pf_kube_labels" "labels" {
  module = "kube_airbyte"
}

module "constants" {
  source = "../kube_constants"
}

# Generate labels for different Airbyte components
module "util_jobs" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-job"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_webapp" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-webapp"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_server" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-server"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_worker" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-worker"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_temporal" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-temporal"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_connector_builder" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-connector-builder-server"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_cron" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-cron"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_pod_sweeper" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-pod-sweeper"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_workload_api_server" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-workload-api-server"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_workload_launcher" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-workload-launcher"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
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

  pg_version                = "14.17" # based on minimum supported version https://docs.temporal.io/clusters#dependency-versions
  pg_cluster_namespace      = local.namespace
  pg_initial_storage_gb     = var.pg_initial_storage_gb
  pg_instances              = var.sla_target >= 2 ? 2 : 1
  pg_smart_shutdown_timeout = 1
  pgbouncer_pool_mode       = "session"

  aws_iam_ip_allow_list                = var.aws_iam_ip_allow_list
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  controller_nodes_enabled             = false
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.sla_target == 3
  vpa_enabled                          = var.vpa_enabled

  pg_minimum_cpu_millicores        = var.pg_min_cpu_millicores
  pg_maximum_cpu_millicores        = var.pg_max_cpu_millicores
  pg_minimum_cpu_update_millicores = var.pg_min_cpu_update_millicores
  pg_minimum_memory_mb             = var.pg_min_memory_mb
  pg_maximum_memory_mb             = var.pg_max_memory_mb
  pgbouncer_minimum_cpu_millicores = var.pgbouncer_min_cpu_millicores
  pgbouncer_maximum_cpu_millicores = var.pgbouncer_max_cpu_millicores
  pgbouncer_minimum_memory_mb      = var.pgbouncer_min_memory_mb
  pgbouncer_maximum_memory_mb      = var.pgbouncer_max_memory_mb

  pg_backup_directory      = var.db_backup_directory
  pg_recovery_mode_enabled = var.db_recovery_mode_enabled
  pg_recovery_directory    = var.db_recovery_directory
  pg_recovery_target_time  = var.db_recovery_target_time
}

/***************************************
* Service Account with S3 Permissions
***************************************/

resource "kubernetes_service_account" "airbyte_sa" {
  metadata {
    name      = "airbyte-admin"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
}

/***************************************
* S3 Storage Configuration
***************************************/

resource "random_id" "airbyte_bucket_name" {
  byte_length = 8
  prefix      = "airbyte-"
}

module "airbyte_bucket" {
  source      = "../aws_s3_private_bucket"
  bucket_name = random_id.airbyte_bucket_name.hex
  description = "Airbyte storage for logs state and workload output"

  intelligent_transitions_enabled = true
  expire_after_days               = 7
}

data "aws_iam_policy_document" "airbyte_bucket" {
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject"
    ]
    resources = concat(
      ["${module.airbyte_bucket.bucket_arn}/*"],
      [for arn in var.connected_s3_bucket_arns : "${arn}/*"]
    )
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket"
    ]
    resources = concat(
      [module.airbyte_bucket.bucket_arn],
      var.connected_s3_bucket_arns
    )
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:GetBucketLocation"
    ]
    resources = ["arn:aws:s3:::*"]
  }

  # Add multipart upload permissions which are needed by the S3 destination
  statement {
    effect = "Allow"
    actions = [
      "s3:ListMultipartUploadParts",
      "s3:AbortMultipartUpload",
      "s3:ListBucketMultipartUploads"
    ]
    resources = concat(
      [module.airbyte_bucket.bucket_arn, "${module.airbyte_bucket.bucket_arn}/*"],
      flatten([for arn in var.connected_s3_bucket_arns : [arn, "${arn}/*"]])
    )
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.airbyte_sa.metadata[0].name
  service_account_namespace = local.namespace
  iam_policy_json           = data.aws_iam_policy_document.airbyte_bucket.json
  ip_allow_list             = var.aws_iam_ip_allow_list
}

/***************************************
* Secret Configuration
***************************************/

resource "random_password" "admin_password" {
  length  = 32
  special = false
}

resource "kubernetes_secret" "airbyte_secrets" {
  metadata {
    name      = "airbyte-config-secrets"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }

  data = {
    "license-key"             = var.license_key # For enterprise edition
    "instance-admin-email"    = var.admin_email
    "instance-admin-password" = random_password.admin_password.result
  }
}

/***************************************
* Airbyte Helm Chart
***************************************/

data "aws_region" "current" {}

resource "helm_release" "airbyte" {
  namespace       = local.namespace
  name            = local.name
  repository      = "https://airbytehq.github.io/helm-charts"
  chart           = "airbyte"
  version         = var.airbyte_helm_version
  recreate_pods   = false
  atomic          = var.wait
  cleanup_on_fail = var.wait
  wait            = var.wait
  force_update    = true
  wait_for_jobs   = true
  max_history     = 5
  timeout         = var.helm_timeout_seconds

  lifecycle {
    precondition {
      condition     = var.temporal_db_max_conns >= var.temporal_db_max_idle_conns
      error_message = "temporal_db_max_conns must be greater than or equal to temporal_db_max_idle_conns"
    }
  }

  values = [
    yamlencode({
      fullnameOverride = "airbyte"

      global = {
        serviceAccountName = kubernetes_service_account.airbyte_sa.metadata[0].name
        edition            = var.airbyte_edition
        airbyteUrl         = "https://${var.domain}"

        image = {
          tag = var.airbyte_version
        }

        auth = {
          enabled = false

          instanceAdmin = {
            secretName        = kubernetes_secret.airbyte_secrets.metadata[0].name
            emailSecretKey    = "instance-admin-email"
            passwordSecretKey = "instance-admin-password"
            firstName         = "boot"
            lastName          = "loader"
          }
        }

        enterprise = {
          secretName          = kubernetes_secret.airbyte_secrets.metadata[0].name
          licenseKeySecretKey = "license-key"
        }

        database = {
          type              = "external"
          secretName        = module.database.superuser_creds_secret
          host              = module.database.pooler_rw_service_name
          port              = module.database.pooler_rw_service_port
          database          = module.database.database
          userSecretKey     = "username"
          passwordSecretKey = "password"
        }

        storage = {
          type = "s3"
          bucket = {
            log            = module.airbyte_bucket.bucket_name
            state          = module.airbyte_bucket.bucket_name
            workloadOutput = module.airbyte_bucket.bucket_name
          }
          s3 = {
            region             = data.aws_region.current.name
            authenticationType = "instanceProfile"
          }
        }

        jobs = {
          resources = {
            requests = {
              memory = "${var.jobs_min_memory_mb}Mi"
              cpu    = "${var.jobs_cpu_min_millicores}m"
            }
            limits = {
              memory = "${floor(var.jobs_min_memory_mb * local.memory_limit_multiplier)}Mi"
            }
          }
          kube = {
            annotations = var.pod_annotations
            labels      = module.util_jobs.labels
            tolerations = module.util_jobs.tolerations
          }
        }

        env_vars = merge(
          var.global_env,
          {
            # Job sync configuration
            SYNC_JOB_RETRIES_COMPLETE_FAILURES_MAX_SUCCESSIVE         = tostring(var.jobs_sync_job_retries_complete_failures_max_successive)
            SYNC_JOB_RETRIES_COMPLETE_FAILURES_MAX_TOTAL              = tostring(var.jobs_sync_job_retries_complete_failures_max_total)
            SYNC_JOB_RETRIES_COMPLETE_FAILURES_BACKOFF_MIN_INTERVAL_S = tostring(var.jobs_sync_job_retries_complete_failures_backoff_min_interval_s)
            SYNC_JOB_RETRIES_COMPLETE_FAILURES_BACKOFF_MAX_INTERVAL_S = tostring(var.jobs_sync_job_retries_complete_failures_backoff_max_interval_s)
            SYNC_JOB_RETRIES_COMPLETE_FAILURES_BACKOFF_BASE           = tostring(var.jobs_sync_job_retries_complete_failures_backoff_base)
            SYNC_JOB_RETRIES_PARTIAL_FAILURES_MAX_SUCCESSIVE          = tostring(var.jobs_sync_job_retries_partial_failures_max_successive)
            SYNC_JOB_RETRIES_PARTIAL_FAILURES_MAX_TOTAL               = tostring(var.jobs_sync_job_retries_partial_failures_max_total)
            SYNC_JOB_MAX_TIMEOUT_DAYS                                 = tostring(var.jobs_sync_max_timeout_days)
          }
        )
      }

      # Disable the default PostgreSQL since we're using our own
      postgresql = {
        enabled = false
      }

      # Webapp configuration
      webapp = {
        enabled        = true
        replicaCount   = var.sla_target >= 2 ? 2 : 1
        podLabels      = module.util_webapp.labels
        podAnnotations = var.pod_annotations

        affinity    = module.util_webapp.affinity
        tolerations = module.util_webapp.tolerations

        resources = {
          requests = {
            memory = "${var.webapp_min_memory_mb}Mi"
            cpu    = "${var.webapp_min_cpu_millicores}m"
          }
          limits = {
            memory = "${var.webapp_min_memory_mb * local.memory_limit_multiplier}Mi"
          }
        }

        service = {
          type        = "ClusterIP"
          port        = 80
          annotations = {}
        }

        ingress = {
          enabled = false # We'll use our own ingress controller
        }
      }

      # Server configuration
      server = {
        enabled        = true
        replicaCount   = var.sla_target >= 2 ? 2 : 1
        podLabels      = module.util_server.labels
        podAnnotations = var.pod_annotations

        affinity    = module.util_server.affinity
        tolerations = module.util_server.tolerations

        log = {
          level = var.log_level
        }

        resources = {
          requests = {
            memory = "${var.server_min_memory_mb}Mi"
            cpu    = "${var.server_min_cpu_millicores}m"
          }
          limits = {
            memory = "${var.server_min_memory_mb * local.memory_limit_multiplier}Mi"
          }
        }
      }

      # Worker configuration
      worker = {
        enabled        = true
        replicaCount   = var.worker_replicas
        podLabels      = module.util_worker.labels
        podAnnotations = var.pod_annotations

        affinity    = module.util_worker.affinity
        tolerations = module.util_worker.tolerations

        log = {
          level = var.log_level
        }

        resources = {
          requests = {
            memory = "${var.worker_min_memory_mb}Mi"
            cpu    = "${var.worker_min_cpu_millicores}m"
          }
          limits = {
            memory = "${var.worker_min_memory_mb * local.memory_limit_multiplier}Mi"
          }
        }
      }

      # Temporal configuration
      # Temporal is used for workflow management
      temporal = {
        enabled      = true
        replicaCount = var.sla_target >= 2 ? 2 : 1
        podLabels    = module.util_temporal.labels
        podAnnotations = {
          "config.linkerd.io/opaque-ports" = "7233"
        }

        affinity    = module.util_temporal.affinity
        tolerations = module.util_temporal.tolerations

        resources = {
          requests = {
            memory = "${var.temporal_min_memory_mb}Mi"
            cpu    = "${var.temporal_min_cpu_millicores}m"
          }
          limits = {
            memory = "${var.temporal_min_memory_mb * local.memory_limit_multiplier}Mi"
          }
        }

        service = {
          type = "ClusterIP"
          port = 7233
        }

        # Add temporal-specific env vars
        extraEnv = [
          {
            name  = "TEMPORAL_DB_HOST"
            value = module.database.rw_service_name # Direct connection for Temporal
          },
          {
            name  = "TEMPORAL_DB_PORT"
            value = tostring(module.database.rw_service_port)
          },
          {
            name  = "POSTGRES_SEEDS"
            value = module.database.rw_service_name # Direct connection
          },
          {
            name  = "DB_PORT"
            value = tostring(module.database.rw_service_port)
          },
          {
            name  = "SQL_MAX_IDLE_CONNS"
            value = tostring(var.temporal_db_max_idle_conns)
          },
          {
            name  = "SQL_MAX_CONNS"
            value = tostring(var.temporal_db_max_conns)
          },
          {
            name = "TEMPORAL_BROADCAST_ADDRESS"
            valueFrom = {
              fieldRef = {
                fieldPath = "status.podIP"
              }
            }
          },
          # Ensure proper service addressing
          {
            name  = "TEMPORAL_ADDRESS"
            value = "airbyte-temporal:7233"
          },
          # Set appropriate timeouts to avoid protocol errors
          {
            name  = "TEMPORAL_CLI_TIMEOUT"
            value = "60s"
          }
        ]
      }

      # Pod sweeper configuration
      "pod-sweeper" = {
        enabled        = true
        podLabels      = module.util_pod_sweeper.labels
        podAnnotations = var.pod_annotations

        affinity    = module.util_pod_sweeper.affinity
        tolerations = module.util_pod_sweeper.tolerations

        resources = {
          requests = {
            memory = "${var.pod_min_sweeper_memory_mb}Mi"
            cpu    = "${var.pod_sweeper_min_cpu_millicores}m"
          }
          limits = {
            memory = "${var.pod_min_sweeper_memory_mb * local.memory_limit_multiplier}Mi"
          }
        }
      }

      # Connector builder server configuration
      "connector-builder-server" = {
        enabled        = true # required to be on https://github.com/airbytehq/airbyte/issues/25174
        podLabels      = module.util_connector_builder.labels
        podAnnotations = var.pod_annotations

        affinity    = module.util_connector_builder.affinity
        tolerations = module.util_connector_builder.tolerations

        log = {
          level = var.log_level
        }

        resources = {
          requests = {
            memory = "${var.connector_min_builder_memory_mb}Mi"
            cpu    = "${var.connector_builder_min_cpu_millicores}m"
          }
          limits = {
            memory = "${var.connector_min_builder_memory_mb * local.memory_limit_multiplier}Mi"
          }
        }
      }

      # Cron configuration
      "cron" = {
        enabled        = true
        podLabels      = module.util_cron.labels
        podAnnotations = var.pod_annotations

        affinity    = module.util_cron.affinity
        tolerations = module.util_cron.tolerations

        log = {
          level = var.log_level
        }

        resources = {
          requests = {
            memory = "${var.cron_min_memory_mb}Mi"
            cpu    = "${var.cron_min_cpu_millicores}m"
          }
          limits = {
            memory = "${var.cron_min_memory_mb * local.memory_limit_multiplier}Mi"
          }
        }
      }

      # Disable MinIO since we're using S3
      minio = {
        enabled = false
      }

      # Workload API server configuration
      "workload-api-server" = {
        enabled        = true
        podLabels      = module.util_workload_api_server.labels
        podAnnotations = var.pod_annotations

        affinity    = module.util_workload_api_server.affinity
        tolerations = module.util_workload_api_server.tolerations

        resources = {
          requests = {
            memory = "${var.workload_api_min_server_memory_mb}Mi"
            cpu    = "${var.workload_api_server_min_cpu_millicores}m"
          }
          limits = {
            memory = "${var.workload_api_min_server_memory_mb * local.memory_limit_multiplier}Mi"
          }
        }
      }

      # Workload launcher configuration
      "workload-launcher" = {
        enabled        = true
        podLabels      = module.util_workload_launcher.labels
        podAnnotations = var.pod_annotations

        affinity    = module.util_workload_launcher.affinity
        tolerations = module.util_workload_launcher.tolerations

        resources = {
          requests = {
            memory = "${var.workload_min_launcher_memory_mb}Mi"
            cpu    = "${var.workload_launcher_min_cpu_millicores}m"
          }
          limits = {
            memory = "${var.workload_min_launcher_memory_mb * local.memory_limit_multiplier}Mi"
          }
        }
      }
    })
  ]

  depends_on = [
    module.database,
    kubernetes_secret.airbyte_secrets,
    module.aws_permissions
  ]
}

/***************************************
* Airbyte Ingress
***************************************/

module "authenticating_proxy" {
  count  = var.ingress_enabled ? 1 : 0
  source = "../kube_vault_proxy"

  namespace                            = local.namespace
  arm_nodes_enabled                    = var.arm_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  vpa_enabled                          = var.vpa_enabled
  domain                               = var.domain
  vault_domain                         = var.vault_domain
  instance_type_anti_affinity_required = var.sla_target == 3
  az_spread_preferred                  = var.sla_target >= 2
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  wait                                 = var.wait
}

module "ingress" {
  count     = var.ingress_enabled ? 1 : 0
  source    = "../kube_ingress"
  namespace = local.namespace
  name      = "airbyte"
  domains   = [var.domain]
  ingress_configs = [{
    service      = "${local.name}-airbyte-webapp-svc"
    service_port = 80
  }]

  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = false
  cross_origin_embedder_policy   = "credentialless"
  permissions_policy_enabled     = true
  csp_enabled                    = true
  cross_origin_opener_policy     = "same-origin-allow-popups"

  # CSP configuration
  csp_style_src  = "'self' 'unsafe-inline'"
  csp_script_src = "'self' 'unsafe-inline'"
  csp_img_src    = "'self' data:"

  idle_timeout_seconds = 600
  body_size_limit_mb   = 50

  extra_annotations = merge(
    module.authenticating_proxy[0].upstream_ingress_annotations
  )

  depends_on = [helm_release.airbyte]
}

/***************************************
* Pod Disruption Budgets
***************************************/

resource "kubectl_manifest" "pdb_webapp" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-webapp"
      namespace = local.namespace
      labels    = module.util_webapp.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_webapp.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "pdb_server" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-server"
      namespace = local.namespace
      labels    = module.util_server.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_server.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "pdb_worker" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-worker"
      namespace = local.namespace
      labels    = module.util_worker.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_worker.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "pdb_connector_builder" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-connector-builder-server"
      namespace = local.namespace
      labels    = module.util_connector_builder.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_connector_builder.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "pdb_pod_sweeper" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-pod-sweeper"
      namespace = local.namespace
      labels    = module.util_pod_sweeper.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_pod_sweeper.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "pdb_temporal" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-temporal"
      namespace = local.namespace
      labels    = module.util_temporal.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_temporal.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "pdb_workload_api_server" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-workload-api-server"
      namespace = local.namespace
      labels    = module.util_workload_api_server.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_workload_api_server.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "pdb_workload_launcher" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-workload-launcher"
      namespace = local.namespace
      labels    = module.util_workload_launcher.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_workload_launcher.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "pdb_job_pods" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-job-pods"
      namespace = local.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = {
          airbyte = "job-pod"
        }
      }
      maxUnavailable = 0
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

/***************************************
* Vertical Pod Autoscalers (Optional)
***************************************/

resource "kubectl_manifest" "vpa_webapp" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-webapp"
      namespace = local.namespace
      labels    = module.util_webapp.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "webapp"
          minAllowed = {
            memory = "${var.webapp_min_memory_mb}Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "airbyte-webapp"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_server" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-server"
      namespace = local.namespace
      labels    = module.util_server.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "server"
          minAllowed = {
            memory = "${var.server_min_memory_mb}Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "airbyte-server"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_worker" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-worker"
      namespace = local.namespace
      labels    = module.util_worker.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "worker"
          minAllowed = {
            memory = "${var.worker_min_memory_mb}Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "airbyte-worker"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_connector_builder" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-connector-builder-server"
      namespace = local.namespace
      labels    = module.util_connector_builder.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "airbyte-connector-builder-server"
          minAllowed = {
            memory = "${var.connector_min_builder_memory_mb}Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "airbyte-connector-builder-server"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_cron" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-cron"
      namespace = local.namespace
      labels    = module.util_cron.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "airbyte-cron"
          minAllowed = {
            memory = "${var.cron_min_memory_mb}Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "airbyte-cron"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_pod_sweeper" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-pod-sweeper"
      namespace = local.namespace
      labels    = module.util_pod_sweeper.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "airbyte-pod-sweeper"
          minAllowed = {
            memory = "${var.pod_min_sweeper_memory_mb}Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "airbyte-pod-sweeper"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_temporal" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-temporal"
      namespace = local.namespace
      labels    = module.util_temporal.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "airbyte-temporal"
          minAllowed = {
            memory = "${var.temporal_min_memory_mb}Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "airbyte-temporal"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_workload_api_server" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-workload-api-server"
      namespace = local.namespace
      labels    = module.util_workload_api_server.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "airbyte-workload-api-server"
          minAllowed = {
            memory = "${var.workload_api_min_server_memory_mb}Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "airbyte-workload-api-server"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_workload_launcher" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-workload-launcher"
      namespace = local.namespace
      labels    = module.util_workload_launcher.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "airbyte-workload-launcher"
          minAllowed = {
            memory = "${var.workload_min_launcher_memory_mb}Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "airbyte-workload-launcher"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

/***************************************
* Image Cache (Optional)
***************************************/

module "image_cache" {
  count  = var.node_image_cached_enabled ? 1 : 0
  source = "../kube_node_image_cache"

  images = [
    {
      registry   = "docker.io"
      repository = "airbyte/webapp"
      tag        = var.airbyte_version
    },
    {
      registry   = "docker.io"
      repository = "airbyte/server"
      tag        = var.airbyte_version
    },
    {
      registry   = "docker.io"
      repository = "airbyte/worker"
      tag        = var.airbyte_version
    },
    {
      registry   = "docker.io"
      repository = "temporalio/auto-setup"
      tag        = "1.26"
    }
  ]
}