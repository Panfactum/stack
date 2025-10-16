terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  cluster-label = "${var.pg_cluster_namespace}-${local.cluster_name}"

  cluster_name = random_id.cluster_id.hex

  smart_shutdown_timeout = var.pg_smart_shutdown_timeout

  poolers_to_enable = toset(concat(
    var.pgbouncer_read_only_enabled ? ["r"] : [],
    var.pgbouncer_read_write_enabled ? ["rw"] : []
  ))

  all_schemas = tolist(toset(concat(var.extra_schemas, ["public"])))

  disruption_window_labels = {
    "panfactum.com/voluntary-disruption-window-id" = var.voluntary_disruption_window_enabled ? module.disruption_window_controller[0].disruption_window_id : "false"
  }

  disruption_window_annotations = {
    "panfactum.com/voluntary-disruption-window-max-unavailable" = "1"
    "panfactum.com/voluntary-disruption-window-seconds"         = tostring(var.voluntary_disruption_window_seconds)
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_pg_cluster"
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

resource "random_id" "cluster_id" {
  byte_length = 2
  prefix      = "pg-"
}

resource "random_id" "pooler_rw_id" {
  byte_length = 2
  prefix      = "pg-pooler-rw-"
}

resource "random_id" "pooler_r_id" {
  byte_length = 2
  prefix      = "pg-pooler-r-"
}

module "util_cluster" {
  source = "../kube_workload_utility"

  workload_name                        = "pg-${random_id.cluster_id.hex}"
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required || (var.burstable_nodes_enabled || var.spot_nodes_enabled) // Force override instance_type_anti_affinity_required if using disruptible nodes as this can lead to a crash loop if all nodes are terminated at once
  az_spread_required                   = true
  az_spread_preferred                  = true // stateful so always on
  lifetime_evictions_enabled           = false
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_pooler" {
  for_each = toset(["r", "rw"])
  source   = "../kube_workload_utility"

  workload_name                        = "pg-pooler-${each.key}-${random_id.cluster_id.hex}"
  burstable_nodes_enabled              = true
  arm_nodes_enabled                    = true
  controller_nodes_enabled             = var.controller_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required
  az_spread_required                   = true
  pod_affinity_match_labels            = module.util_cluster.match_labels
  lifetime_evictions_enabled           = false
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

/***************************************
* S3 Backup
***************************************/

resource "random_id" "bucket_name" {
  byte_length = 8
  prefix      = "${var.pg_cluster_namespace}-${local.cluster_name}-backup-"
}

moved {
  from = random_id.bucket_name[0]
  to   = random_id.bucket_name
}

module "s3_bucket" {
  source = "../aws_s3_private_bucket"

  bucket_name                     = random_id.bucket_name.hex
  description                     = "Backups for the ${local.cluster_name} cluster."
  versioning_enabled              = false
  audit_log_enabled               = false
  intelligent_transitions_enabled = false // db operator takes care of garbage collection
  force_destroy                   = var.backups_force_delete

  access_policy = var.s3_bucket_access_policy
}

moved {
  from = module.s3_bucket[0]
  to   = module.s3_bucket
}

data "aws_iam_policy_document" "s3_access" {
  statement {
    effect  = "Allow"
    actions = ["s3:*"]
    resources = tolist(toset(concat(
      [
        module.s3_bucket.bucket_arn,
        "${module.s3_bucket.bucket_arn}/*"
      ],
      var.pg_recovery_bucket != null ? [
        "arn:aws:s3:::${var.pg_recovery_bucket}",
        "arn:aws:s3:::${var.pg_recovery_bucket}/*"
      ] : []
    )))
  }
}

module "irsa" {
  source = "../kube_sa_auth_aws"

  service_account           = local.cluster_name
  service_account_namespace = var.pg_cluster_namespace
  iam_policy_json           = data.aws_iam_policy_document.s3_access.json
  ip_allow_list             = var.aws_iam_ip_allow_list

  // Due to a limitation in the cluster resource api, the cluster resource is the one that creates
  // the service account for us, so we let it to the annotations
  annotate_service_account = false
}

moved {
  from = module.irsa[0]
  to   = module.irsa
}

/***************************************
* Certs
***************************************/

resource "random_id" "server_certs_secret" {
  prefix      = "pg-server-certs-"
  byte_length = 2
}

module "server_certs" {
  source      = "../kube_internal_cert"
  secret_name = random_id.server_certs_secret.hex
  namespace   = var.pg_cluster_namespace
  service_names = [
    local.cluster_name,
    "${local.cluster_name}-rw",
    "${local.cluster_name}-r",
    "${local.cluster_name}-ro",
    "${local.cluster_name}-pooler-r",
    "${local.cluster_name}-pooler-rw"
  ]

  extra_labels = {
    "cnpg.io/reload" = ""
  }
}

resource "random_id" "client_certs_secret" {
  prefix      = "pg-client-certs-"
  byte_length = 2
}

module "client_certs" {
  source      = "../kube_internal_cert"
  secret_name = random_id.client_certs_secret.hex
  namespace   = var.pg_cluster_namespace
  usages      = ["client auth"]
  common_name = "streaming_replica"

  extra_labels = {
    "cnpg.io/reload" = ""
  }
}

/***************************************
* Root Password
***************************************/

resource "time_rotating" "superuser_password_rotation" {
  rotation_days = 7
}

resource "random_password" "superuser_password" {
  length  = 64
  special = false
  keepers = {
    rotate = time_rotating.superuser_password_rotation.id
  }
}

resource "kubernetes_secret" "superuser" {
  type = "kubernetes.io/basic-auth"
  metadata {
    name      = "${local.cluster_name}-superuser-${sha256(random_password.superuser_password.result)}"
    namespace = var.pg_cluster_namespace
    labels = {
      "cnpg.io/reload" = ""
    }
  }

  data = {
    password = random_password.superuser_password.result
    pgpass   = "${local.cluster_name}-rw:5432:*:postgres:${random_password.superuser_password.result}"
    username = "postgres"
  }
}


/***************************************
* Cluster
***************************************/

resource "kubernetes_manifest" "postgres_cluster" {
  manifest = {
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "Cluster"
    metadata = {
      name      = local.cluster_name
      namespace = var.pg_cluster_namespace
      labels    = module.util_cluster.labels
      annotations = {
        "config.linkerd.io/skip-inbound-ports" = "5432" # Postgres communication is already tls-secured by CNPG

        "panfactum.com/db"             = "true"
        "panfactum.com/db-type"        = "PostgreSQL"
        "panfactum.com/reader-role"    = "reader-${var.pg_cluster_namespace}-${local.cluster_name}"
        "panfactum.com/admin-role"     = "admin-${var.pg_cluster_namespace}-${local.cluster_name}"
        "panfactum.com/superuser-role" = "superuser-${var.pg_cluster_namespace}-${local.cluster_name}"
        "panfactum.com/vault-mount"    = "db/${var.pg_cluster_namespace}-${local.cluster_name}"
        "panfactum.com/service"        = "${local.cluster_name}-pooler-rw.${var.pg_cluster_namespace}"
        "panfactum.com/service-port"   = "5432"
      }
    }
    spec = { for k, v in {
      imageName             = var.pg_custom_image != null ? var.pg_custom_image : "${module.pull_through.github_registry}/cloudnative-pg/postgresql:${var.pg_version}"
      instances             = var.pg_instances
      minSyncReplicas       = var.pg_sync_replication_enabled ? var.pg_instances - 1 : 0
      primaryUpdateStrategy = "unsupervised"
      primaryUpdateMethod   = "switchover"
      enablePDB             = false // We perform our own PDB logic
      schedulerName         = module.util_cluster.scheduler_name

      // This is required for Vault as vault uses
      // the superuser to dynamically provision the less-privileged users
      enableSuperuserAccess = true
      superuserSecret = {
        name = kubernetes_secret.superuser.metadata[0].name
      }

      certificates = {
        serverTLSSecret      = module.server_certs.secret_name
        serverCASecret       = module.server_certs.secret_name
        clientCASecret       = module.client_certs.secret_name
        replicationTLSSecret = module.client_certs.secret_name
      }

      inheritedMetadata = {
        labels = merge(
          module.util_cluster.labels,
          {
            pg-cluster = local.cluster-label
          }
        )
        annotations = {
          "linkerd.io/inject"                    = "enabled"
          "config.linkerd.io/skip-inbound-ports" = "5432" # Postgres communication is already tls-secured by CNPG
          "resize.topolvm.io/storage_limit"      = "${(var.pg_storage_limit_gb != null ? var.pg_storage_limit_gb : max(100, 10 * var.pg_initial_storage_gb)) + var.pg_max_slot_wal_keep_size_gb}Gi"
          "resize.topolvm.io/increase"           = "${var.pg_storage_increase_gb}Gi"
          "resize.topolvm.io/threshold"          = "${var.pg_storage_increase_threshold_percent}%"
        }
      }

      startDelay = 60 * 10

      # If a shutdown exceeds this amount of time,
      # an immediate shutdown will occur (which has the possibility for data loss)
      stopDelay = local.smart_shutdown_timeout + var.pg_switchover_delay

      # These both control the amount of time that a postgres primary may be in a terminating
      # state until a fast shutdown is initiated
      # A fast shutdown will immediately cancel all running queries
      smartShutdownTimeout = local.smart_shutdown_timeout
      failoverDelay        = local.smart_shutdown_timeout

      # Controls max amount of time that CNPG will wait for data to be synced from primary to replica before forcing the switchover
      # Note that this doesn't delay ALL switchovers by this amount; this is only the MAXIMUM delay
      # Setting this lower reduces downtime but introduces the possibility for data loss
      switchoverDelay = var.pg_switchover_delay

      monitoring = {
        enablePodMonitor = var.monitoring_enabled
      }

      postgresql = {
        parameters = merge(
          { for k, v in {
            # Defaults - Need to be provided to avoid reconciliation error
            archive_mode               = "on"
            archive_timeout            = "5min"
            dynamic_shared_memory_type = "posix"
            full_page_writes           = "on"
            log_destination            = "csvlog"
            log_directory              = "/controller/log"
            log_filename               = "postgres"
            log_rotation_age           = "0"
            log_rotation_size          = "0"
            log_truncate_on_rotation   = "false"
            logging_collector          = "on"
            max_parallel_workers       = "32"
            max_replication_slots      = "32"
            max_worker_processes       = "32"
            shared_memory_type         = "mmap"
            shared_preload_libraries   = ""
            ssl_max_protocol_version   = "TLSv1.3"
            ssl_min_protocol_version   = "TLSv1.3"
            wal_keep_size              = "${var.pg_wal_keep_size_gb}GB"
            wal_level                  = "logical"
            wal_log_hints              = "on"
            wal_receiver_timeout       = "5s"
            wal_sender_timeout         = "5s"
            max_slot_wal_keep_size     = "${var.pg_max_slot_wal_keep_size_gb}GB"

            # Memory tuning - Based on guide created by EDB (creators of CNPG)
            # https://www.enterprisedb.com/postgres-tutorials/how-tune-postgresql-memory
            # If the VPA is enabled, us Kyverno to set these by setting them null in here.
            max_connections      = var.pg_max_connections
            shared_buffers       = var.vpa_enabled ? null : "${ceil(var.pg_minimum_memory_mb * var.pg_shared_buffers_percent / 100)}MB"
            work_mem             = var.vpa_enabled ? null : "${max(ceil(var.pg_minimum_memory_mb * var.pg_work_mem_percent / 100 / var.pg_max_connections), 4)}MB"
            maintenance_work_mem = var.vpa_enabled ? null : "${ceil(var.pg_minimum_memory_mb * var.pg_maintenance_work_mem_percent / 100)}MB"
            effective_cache_size = var.vpa_enabled ? null : "${ceil(var.pg_minimum_memory_mb * max((100 - var.pg_work_mem_percent - var.pg_maintenance_work_mem_percent - 10), var.pg_shared_buffers_percent) / 100)}MB"
          } : k => v if v != null },
          var.pg_parameters
        )
      }

      bootstrap = { for k, v in {
        recovery = var.pg_recovery_mode_enabled ? { for k, v in {
          source = var.pg_recovery_directory
          # Note: The Terraform kubernetes provider requires ALL recoveryTarget fields to be set,
          # even though the CloudNativePG CRD itself marks all fields as optional. This is a
          # Terraform provider schema validation issue, not a CloudNativePG requirement.
          # We must use merge() with all fields set to null to satisfy the provider's type system.
          recoveryTarget = var.pg_recovery_target_time != null ? merge(
            {
              backupID        = null
              exclusive       = null
              targetImmediate = null
              targetLSN       = null
              targetName      = null
              targetTLI       = null
              targetTime      = var.pg_recovery_target_time
              targetXID       = null
            }
            ) : var.pg_recovery_target_immediate != null ? merge(
            {
              backupID        = var.pg_recovery_target_immediate
              exclusive       = null
              targetImmediate = true
              targetLSN       = null
              targetName      = null
              targetTLI       = null
              targetTime      = null
              targetXID       = null
            }
          ) : null
        } : k => v if v != null } : null
        initdb = !var.pg_recovery_mode_enabled ? {
          postInitSQL = [

            // This ensures that the default users have no privileges
            // Otherwise, users have the ability to create arbitrary
            // tables and data in the database, potentially opening
            // us up for a DOS attack;
            // Since there are two databases (postgres and app), we need
            // to run this after each db init
            "REVOKE ALL ON SCHEMA public FROM PUBLIC;",

            // Grant privileges to pgbouncer
            "CREATE ROLE cnpg_pooler_pgbouncer WITH LOGIN;",
            "GRANT USAGE ON SCHEMA public to cnpg_pooler_pgbouncer;",
            "GRANT CONNECT ON DATABASE postgres TO cnpg_pooler_pgbouncer;",
            "CREATE OR REPLACE FUNCTION public.user_search(uname TEXT) RETURNS TABLE (usename name, passwd text) LANGUAGE sql SECURITY DEFINER AS 'SELECT usename, passwd FROM pg_catalog.pg_shadow WHERE usename=$1;'",
            "REVOKE ALL ON FUNCTION public.user_search(text) FROM public;",
            "GRANT EXECUTE ON FUNCTION public.user_search(text) TO cnpg_pooler_pgbouncer;"
          ]
          postInitApplicationSQL = flatten([

            // See above
            "REVOKE ALL ON SCHEMA public FROM PUBLIC;",

            // Creates the user groups that we assign dynamic roles to
            "CREATE ROLE reader NOINHERIT;",
            "GRANT pg_read_all_data TO reader;",
            [
              for schema in local.all_schemas : "GRANT USAGE ON SCHEMA ${schema} TO reader;"
            ],

            "CREATE ROLE writer NOINHERIT;",
            "GRANT pg_write_all_data, pg_read_all_data TO writer;",
            [
              for schema in local.all_schemas : "GRANT ALL PRIVILEGES ON SCHEMA ${schema} TO writer;"
            ],

            // Grant privileges to pgbouncer
            "GRANT CONNECT ON DATABASE app TO cnpg_pooler_pgbouncer;",
            "GRANT USAGE ON SCHEMA public to cnpg_pooler_pgbouncer;",
            "CREATE OR REPLACE FUNCTION public.user_search(uname TEXT) RETURNS TABLE (usename name, passwd text) LANGUAGE sql SECURITY DEFINER AS 'SELECT usename, passwd FROM pg_catalog.pg_shadow WHERE usename=$1;'",
            "REVOKE ALL ON FUNCTION public.user_search(text) FROM public;",
            "GRANT EXECUTE ON FUNCTION public.user_search(text) TO cnpg_pooler_pgbouncer;"
          ])
        } : null
      } : k => v if v != null }

      externalClusters = var.pg_recovery_mode_enabled ? [{
        name = var.pg_recovery_directory
        barmanObjectStore = {
          destinationPath = "s3://${var.pg_recovery_bucket != null ? var.pg_recovery_bucket : module.s3_bucket.bucket_name}/"
          serverName      = var.pg_recovery_directory
          s3Credentials = {
            inheritFromIAMRole = true
          }
          data = {
            maxParallel = 16
          }
          wal = {
            maxParallel = 8
          }
        }
      }] : null

      priorityClassName = module.constants.workload_important_priority_class_name

      // Try to spread the instances evenly across the availability zones
      topologySpreadConstraints = module.util_cluster.topology_spread_constraints

      affinity = { for k, v in {
        // The default affinity rules are broken as they result in anti-affinity with the poolers
        enablePodAntiAffinity = false

        // These still work even if 'enablePodAntiAffinity' is false
        additionalPodAntiAffinity = lookup(module.util_cluster.affinity, "podAntiAffinity", null)
        additionalPodAffinity     = lookup(module.util_cluster.affinity, "podAffinity", null)

        // Allow the clusters to be scheduled on particular node types
        tolerations = module.util_cluster.tolerations
      } : k => v if v != null }

      storage = {
        pvcTemplate = {
          resources = {
            requests = {
              storage = "${var.pg_initial_storage_gb + var.pg_max_slot_wal_keep_size_gb}Gi"
            }
          }
          storageClassName = "ebs-standard"
        }
      }
      serviceAccountTemplate = {
        metadata = {
          annotations = {
            "eks.amazonaws.com/role-arn" = module.irsa.role_arn
          }
        }
      }
      backup = {
        target = "prefer-standby"
        volumeSnapshot = {
          className              = "cnpg"
          snapshotOwnerReference = "backup"
          online                 = true
          onlineConfiguration = {
            immediateCheckpoint = false
            waitForArchive      = true
          }
        }
        barmanObjectStore = {
          destinationPath = "s3://${module.s3_bucket.bucket_name}/"
          serverName      = var.pg_backup_directory
          s3Credentials = {
            inheritFromIAMRole = true
          }

          data = {
            compression = "snappy"
            jobs        = 16
            additionalCommandArgs = [
              "--min-chunk-size=100MB",
              "--max-archive-size=5GB"
            ]
          }
          wal = {
            compression = "snappy"
            maxParallel = 8
          }
        }
        retentionPolicy = "${var.backups_retention_days}d"
      }
    } : k => v if v != null }
  }

  wait {
    condition {
      type   = "Ready"
      status = "True"
    }
  }
  field_manager {
    force_conflicts = true
  }

  computed_fields = [
    "metadata.labels",
    "metadata.annotations",
    "spec.selector",

    // We control resource settings from Kyverno so that we can (a)
    // link the resource requests to the postgresql.parameters,
    // (b) work around some problems with unit parsing in the IaC provider, and (c)
    // allow the CNPG operator to handle pod reconciliation rather than
    // relying on pod evictions (should be slightly more stable this way)
    "spec.resources",
    "spec.postgresql.parameters"
  ]

  depends_on = [
    module.client_certs,
    module.server_certs,
    kubectl_manifest.non_vpa_resource_adjustments
  ]

  timeouts {
    create = "${var.create_timeout_minutes}m"
  }

  lifecycle {
    precondition {
      condition     = var.pg_max_slot_wal_keep_size_gb >= var.pg_wal_keep_size_gb
      error_message = "pg_max_slot_wal_keep_size_gb must be greater than or equal to pg_wal_keep_size_gb"
    }
  }
}

/***************************************
* Backup Configuration
***************************************/

resource "kubectl_manifest" "scheduled_backup" {
  yaml_body = yamlencode({
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "ScheduledBackup"
    metadata = {
      name      = "${local.cluster_name}-default-${var.pg_backup_directory}"
      namespace = var.pg_cluster_namespace
    }
    spec = {
      schedule             = var.backups_cron_schedule
      backupOwnerReference = "cluster"
      cluster = {
        name = local.cluster_name
      }
      immediate = true // create first backup immediately after scheduled backup is created
      target    = "prefer-standby"
      method    = "barmanObjectStore"
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubernetes_manifest.postgres_cluster]
}

resource "kubectl_manifest" "failed_backup_gc" {
  count = var.gc_failed_backups ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v2"
    kind       = "CleanupPolicy"
    metadata = {
      name      = "failed-backup-gc-${local.cluster_name}"
      namespace = var.pg_cluster_namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      match = {
        any = [{
          resources = {
            kinds = ["postgresql.cnpg.io/v1/Backup"]
            names = ["${local.cluster_name}-*"]
          }
        }]
      }
      conditions = {
        all = [
          {
            key      = "{{ target.status.phase }}"
            operator = "Equals"
            value    = "failed"
          },
          {
            key      = "{{ time_since('', '{{ target.metadata.creationTimestamp }}', '') }}"
            operator = "GreaterThan"
            value    = "${var.backups_retention_days * 24}h0m0s"
          }
        ]
      }
      schedule = "0 * * * *"
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on = [
    kubectl_manifest.vpa_cluster
  ]
}

/***************************************
* Vertical Autoscaling
***************************************/

resource "kubectl_manifest" "vpa_cluster" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = random_id.cluster_id.hex
      namespace = var.pg_cluster_namespace
      labels    = module.util_cluster.labels
    }
    spec = {
      targetRef = {
        apiVersion = "postgresql.cnpg.io/v1"
        kind       = "Cluster"
        name       = local.cluster_name
      }
      resourcePolicy = {
        containerPolicies = [{
          containerName = "postgres"
          minAllowed = {
            cpu    = "${var.pg_minimum_cpu_millicores}m"
            memory = "${var.pg_minimum_memory_mb}Mi"
          }
          maxAllowed = {
            cpu    = "${var.pg_maximum_cpu_millicores}m"
            memory = "${var.pg_maximum_memory_mb}Mi"
          }
        }]
      }
      // Update mode is off b/c we use kyverno to propagate the resource recommendations to the cluster resource
      // as additional computations need to be done based on the memory request
      updatePolicy = {
        updateMode = "Off"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubernetes_manifest.postgres_cluster]
}

resource "kubectl_manifest" "vpa_adjustments" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "Policy"
    metadata = {
      name      = "cnpg-vpa-adjustments-${local.cluster_name}"
      namespace = var.pg_cluster_namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      generateExisting             = true
      mutateExistingOnPolicyUpdate = true
      useServerSideApply           = true
      rules = [
        {
          name = "adjust-memory"
          match = {
            resources = {
              kinds = ["autoscaling.k8s.io/v1/VerticalPodAutoscaler"]
              names = [local.cluster_name]
            }
          }
          context = [
            {
              name = "memory"
              variable = {
                value = "{{ divide('{{ request.object.status.recommendation.containerRecommendations[?containerName == 'postgres'] | [0].target.memory || '${var.pg_minimum_memory_mb}Mi' }}', '1') || `${var.pg_minimum_memory_mb * 1024 * 1024}` }}"
              }
            }
          ]
          mutate = {
            mutateExistingOnPolicyUpdate = true
            targets = [
              {
                apiVersion = "postgresql.cnpg.io/v1"
                kind       = "Cluster"
                name       = local.cluster_name
                namespace  = var.pg_cluster_namespace
              }
            ]
            patchesJson6902 = yamlencode([
              {
                op    = "add"
                path  = "/spec/postgresql/parameters/shared_buffers"
                value = lookup(var.pg_parameters, "shared_buffers", "{{ round(multiply(`{{ memory }}`, `${var.pg_shared_buffers_percent / 100}`), `0`) }}B")
              },
              {
                op    = "add"
                path  = "/spec/postgresql/parameters/work_mem"
                value = lookup(var.pg_parameters, "work_mem", "{{ max([round(multiply(`{{ memory }}`, `${var.pg_work_mem_percent / 100 / var.pg_max_connections}`), `0`), `${1024 * 1024 * 4}`]) }}B")
              },
              {
                op    = "add"
                path  = "/spec/postgresql/parameters/maintenance_work_mem"
                value = lookup(var.pg_parameters, "maintenance_work_mem", "{{ round(multiply(`{{ memory }}`, `${var.pg_maintenance_work_mem_percent / 100}`), `0`) }}B")
              },
              {
                op    = "add"
                path  = "/spec/postgresql/parameters/effective_cache_size"
                value = lookup(var.pg_parameters, "effective_cache_size", "{{ round(multiply(`{{ memory }}`, `${max((100 - var.pg_work_mem_percent - var.pg_maintenance_work_mem_percent - 10), var.pg_shared_buffers_percent) / 100}`), `0`) }}B")
              },
              {
                op    = "add"
                path  = "/spec/resources/requests/memory"
                value = "{{ round(divide(`{{ memory }}`, `1000`), `0`) }}k"
              },
              {
                op    = "add"
                path  = "/spec/resources/limits/memory"
                value = "{{ round(divide(`{{ memory }}`, `900`), `0`) }}k"
              }
            ])
          }
        },
        {
          name = "adjust-cpu"
          match = {
            resources = {
              kinds = ["autoscaling.k8s.io/v1/VerticalPodAutoscaler"]
              names = [local.cluster_name]
            }
          }
          context = [
            {
              name = "cpuRecommendation"
              variable = {
                jmesPath = "request.object.status.recommendation.containerRecommendations[?containerName == 'postgres'] | [0].target.cpu || '${var.pg_minimum_cpu_millicores}m'"
              }
            },
            {
              name = "cpuCurrent"
              apiCall = {
                urlPath  = "/apis/postgresql.cnpg.io/v1/namespaces/${var.pg_cluster_namespace}/clusters/${local.cluster_name}"
                jmesPath = "spec.resources.requests.cpu || '0m'"
              }
            }
          ]

          // This is required to prevent thrash at lower CPU levels
          preconditions = {
            any = [
              {
                key      = "{{ subtract(cpuRecommendation, cpuCurrent) }}"
                operator = "GreaterThan"
                value    = "${var.pg_minimum_cpu_update_millicores}m"
                message  = "CPU recommendation is not ${var.pg_minimum_cpu_update_millicores}m greater than current setting."
              },
              {
                key      = "{{ subtract(cpuCurrent, cpuRecommendation) }}"
                operator = "GreaterThan"
                value    = "${var.pg_minimum_cpu_update_millicores}m"
                message  = "CPU recommendation is not ${var.pg_minimum_cpu_update_millicores}m less than current setting."
              }
            ]
          }

          mutate = {
            mutateExistingOnPolicyUpdate = true
            targets = [
              {
                apiVersion = "postgresql.cnpg.io/v1"
                kind       = "Cluster"
                name       = local.cluster_name
                namespace  = var.pg_cluster_namespace
              }
            ]
            patchesJson6902 = yamlencode([
              {
                op    = "add"
                path  = "/spec/resources/requests/cpu"
                value = "{{ cpuRecommendation }}"
              },
            ])
          }
        }
      ]
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on = [
    kubectl_manifest.vpa_cluster
  ]
}

// This is required b/c we ignore the resources set on the manifest
// in order to accommodate the case where the VPA IS enabled.
resource "kubectl_manifest" "non_vpa_resource_adjustments" {
  count = var.vpa_enabled ? 0 : 1
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "Policy"
    metadata = {
      name      = "cnpg-adjustments-${local.cluster_name}"
      namespace = var.pg_cluster_namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      generateExisting             = true
      mutateExistingOnPolicyUpdate = true
      useServerSideApply           = true
      rules = [
        {
          name = "adjust-cluster-resources"
          match = {
            resources = {
              kinds = ["postgresql.cnpg.io/v1/Cluster"]
              names = [local.cluster_name]
            }
          }
          mutate = {
            mutateExistingOnPolicyUpdate = true
            targets = [
              {
                apiVersion = "postgresql.cnpg.io/v1"
                kind       = "Cluster"
                name       = local.cluster_name
                namespace  = var.pg_cluster_namespace
              }
            ]
            patchesJson6902 = yamlencode([
              {
                op    = "add"
                path  = "/spec/resources/requests/memory"
                value = "${var.pg_minimum_memory_mb}Mi"
              },
              {
                op    = "add"
                path  = "/spec/resources/requests/cpu"
                value = "${var.pg_minimum_cpu_millicores}m"
              },
              {
                op    = "add"
                path  = "/spec/resources/limits/memory"
                value = "${ceil(var.pg_minimum_memory_mb * 1.1)}Mi"
              }
            ])
          }
        }
      ]
    }
  })
  force_conflicts   = true
  server_side_apply = true
}

/***************************************
* Vault Authentication
***************************************/

// Note: We MUST create the reader and writer roles here
// b/c we cannot grant direct table access to the dynamic roles
// generated by vault as the access control table runs out of space
// See https://stackoverflow.com/questions/57087519/row-is-too-big-maximum-size-8160-when-running-grant-connect-on-database

resource "vault_database_secret_backend_role" "reader" {
  backend = "db"
  name    = "reader-${var.pg_cluster_namespace}-${local.cluster_name}"
  db_name = vault_database_secret_backend_connection.postgres.name
  creation_statements = flatten([
    // We have to re-run the generic grant commands
    // on every login to make sure we have picked up new objects
    [for schema in local.all_schemas : [
      "GRANT USAGE ON SCHEMA ${schema} to reader;",
      "GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO reader;",
      "GRANT SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO reader;",
      "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO reader;",
    ]],

    // Create the temporary role and assign them to the reader group
    "CREATE ROLE \"{{name}}\" LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",
    "GRANT reader TO \"{{name}}\";"
  ])
  renew_statements = [
    "ALTER ROLE \"{{name}}\" VALID UNTIL '{{expiration}}'"
  ]
  revocation_statements = [
    // Reassign ownership so we can drop
    "REASSIGN OWNED BY \"{{name}}\" TO postgres",

    // Drop all privileges (including the default privileges)
    "DROP OWNED BY \"{{name}}\";",

    // Do the drop
    "DROP ROLE IF EXISTS \"{{name}}\""
  ]
  default_ttl = 60 * 60 * var.vault_credential_lifetime_hours
  max_ttl     = 60 * 60 * var.vault_credential_lifetime_hours
}

resource "vault_database_secret_backend_role" "admin" {
  backend = "db"
  name    = "admin-${var.pg_cluster_namespace}-${local.cluster_name}"
  db_name = vault_database_secret_backend_connection.postgres.name
  creation_statements = flatten([
    // We have to re-run the generic grant commands
    // on every login to make sure we have picked up new objects
    [for schema in local.all_schemas : [
      "GRANT USAGE ON SCHEMA ${schema} to writer;",
      "GRANT CREATE ON SCHEMA ${schema} to writer;",
      "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} TO writer;",
      "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} TO writer;",
      "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schema} TO writer;",
      "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${schema} TO writer;"
    ]],

    // Create the temporary role and assign them to the writer group
    "CREATE ROLE \"{{name}}\" LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",
    "GRANT writer TO \"{{name}}\";",

    // Ensure that new objects this role generates propagate permissions to the other roles
    [for schema in local.all_schemas : [
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT ALL PRIVILEGES ON TABLES TO writer;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT ALL PRIVILEGES ON SEQUENCES TO writer;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT ALL PRIVILEGES ON FUNCTIONS TO writer;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT ALL PRIVILEGES ON TYPES TO writer;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT SELECT ON TABLES TO reader;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT SELECT ON SEQUENCES TO reader;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT EXECUTE ON FUNCTIONS TO reader;"
    ]],
  ])
  renew_statements = [
    "ALTER ROLE \"{{name}}\" VALID UNTIL '{{expiration}}'"
  ]
  revocation_statements = [
    // Reassign ownership so we can drop
    "REASSIGN OWNED BY \"{{name}}\" TO postgres",

    // Drop all privileges (including the default privileges)
    "DROP OWNED BY \"{{name}}\";",

    // Do the drop
    "DROP ROLE IF EXISTS \"{{name}}\""
  ]
  default_ttl = 60 * 60 * var.vault_credential_lifetime_hours
  max_ttl     = 60 * 60 * var.vault_credential_lifetime_hours
}

resource "vault_database_secret_backend_role" "superuser" {
  backend = "db"
  name    = "superuser-${var.pg_cluster_namespace}-${local.cluster_name}"
  db_name = vault_database_secret_backend_connection.postgres.name
  creation_statements = flatten([
    "CREATE ROLE \"{{name}}\" SUPERUSER LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",

    [for schema in local.all_schemas : [
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT ALL PRIVILEGES ON TABLES TO writer;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT ALL PRIVILEGES ON SEQUENCES TO writer;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT ALL PRIVILEGES ON FUNCTIONS TO writer;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT ALL PRIVILEGES ON TYPES TO writer;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT SELECT ON TABLES TO reader;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT SELECT ON SEQUENCES TO reader;",
      "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA ${schema} GRANT EXECUTE ON FUNCTIONS TO reader;"
    ]],
  ])
  renew_statements = [
    "ALTER ROLE \"{{name}}\" VALID UNTIL '{{expiration}}'"
  ]
  revocation_statements = [
    // Reassign ownership so we can drop
    "REASSIGN OWNED BY \"{{name}}\" TO postgres",

    // Drop all privileges (including the default privileges)
    "DROP OWNED BY \"{{name}}\";",

    // Do the drop
    "DROP ROLE IF EXISTS \"{{name}}\""
  ]

  default_ttl = 60 * 60 * var.vault_credential_lifetime_hours
  max_ttl     = 60 * 60 * var.vault_credential_lifetime_hours
}

resource "vault_database_secret_backend_connection" "postgres" {
  backend = "db"
  name    = "${var.pg_cluster_namespace}-${local.cluster_name}"
  allowed_roles = [
    "superuser-${var.pg_cluster_namespace}-${local.cluster_name}",
    "reader-${var.pg_cluster_namespace}-${local.cluster_name}",
    "admin-${var.pg_cluster_namespace}-${local.cluster_name}"
  ]

  postgresql {
    connection_url = "postgres://postgres:${random_password.superuser_password.result}@${local.cluster_name}-rw.${var.pg_cluster_namespace}:5432/app"
  }

  verify_connection = false

  depends_on = [kubernetes_manifest.postgres_cluster]
}

/***************************************
* Vault Secrets
***************************************/

data "vault_policy_document" "vault_secrets" {
  rule {
    path         = "db/creds/${vault_database_secret_backend_role.reader.name}"
    capabilities = ["read", "list"]
    description  = "Allows getting read-only database credentials"
  }
  rule {
    path         = "db/creds/${vault_database_secret_backend_role.admin.name}"
    capabilities = ["read", "list"]
    description  = "Allows getting admin database credentials"
  }
  rule {
    path         = "db/creds/${vault_database_secret_backend_role.superuser.name}"
    capabilities = ["read", "list"]
    description  = "Allows getting superuser database credentials"
  }
}

module "vault_auth_vault_secrets" {
  source                    = "../kube_sa_auth_vault"
  service_account           = local.cluster_name
  service_account_namespace = var.pg_cluster_namespace
  vault_policy_hcl          = data.vault_policy_document.vault_secrets.hcl
  audience                  = "vault"
}

resource "kubectl_manifest" "vault_connection" {
  yaml_body = yamlencode({
    apiVersion = "secrets.hashicorp.com/v1beta1"
    kind       = "VaultConnection"
    metadata = {
      name      = local.cluster_name
      namespace = var.pg_cluster_namespace
      labels    = module.util_cluster.labels
    }
    spec = {
      address = "http://vault-active.vault.svc.cluster.local:8200"
    }
  })
  force_conflicts   = true
  server_side_apply = true
}

resource "kubectl_manifest" "vault_auth" {
  yaml_body = yamlencode({
    apiVersion = "secrets.hashicorp.com/v1beta1"
    kind       = "VaultAuth"
    metadata = {
      name      = local.cluster_name
      namespace = var.pg_cluster_namespace
      labels    = module.util_cluster.labels
    }
    spec = {
      vaultConnectionRef = local.cluster_name
      method             = "kubernetes"
      mount              = "kubernetes"
      allowedNamespaces  = [var.pg_cluster_namespace]
      kubernetes = {
        role           = module.vault_auth_vault_secrets.role_name
        serviceAccount = local.cluster_name
        audiences      = ["vault"]
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.vault_connection]
}

resource "kubectl_manifest" "vault_secrets" {
  for_each = {
    admin     = "creds/${vault_database_secret_backend_role.admin.name}"
    reader    = "creds/${vault_database_secret_backend_role.reader.name}"
    superuser = "creds/${vault_database_secret_backend_role.superuser.name}"
  }
  yaml_body = yamlencode({
    apiVersion = "secrets.hashicorp.com/v1beta1"
    kind       = "VaultDynamicSecret"
    metadata = {
      name      = "${local.cluster_name}-${each.key}-creds"
      namespace = var.pg_cluster_namespace
      labels    = module.util_cluster.labels
    }
    spec = {
      vaultAuthRef   = local.cluster_name
      mount          = "db"
      path           = each.value
      renewalPercent = 50
      destination = {
        create = true
        name   = "${local.cluster_name}-${each.key}-creds"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.vault_auth]
}

/***************************************
* Connection Poolers
***************************************/

resource "random_id" "pooler_secret" {
  prefix      = "pg-pooler-certs-"
  byte_length = 2
}

// pgbouncer will authenticate with a rotating client
// cert rather than a static password
module "pooler_certs" {
  source = "../kube_internal_cert"

  secret_name = random_id.pooler_secret.hex
  namespace   = var.pg_cluster_namespace
  usages      = ["client auth"]
  common_name = "cnpg_pooler_pgbouncer"
  extra_labels = {
    "cnpg.io/reload" = ""
  }
}


resource "kubectl_manifest" "connection_pooler" {
  for_each = local.poolers_to_enable
  yaml_body = yamlencode({
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "Pooler"
    metadata = {
      name      = "${local.cluster_name}-pooler-${each.key}"
      namespace = var.pg_cluster_namespace
      labels    = module.util_pooler[each.key].labels
    }
    spec = {
      cluster = {
        name = local.cluster_name
      }
      instances = var.pg_instances
      type      = each.key == "r" ? "ro" : "rw"
      pgbouncer = {
        authQuerySecret = {
          name = module.pooler_certs.secret_name
        }
        authQuery = "SELECT usename, passwd FROM public.user_search($1)"
        poolMode  = var.pgbouncer_pool_mode
        parameters = { for k, v in {
          max_client_conn           = tostring(var.pgbouncer_max_client_conn)
          log_connections           = tostring(var.pgbouncer_log_connections ? 1 : 0)
          log_disconnections        = tostring(var.pgbouncer_log_disconnections ? 1 : 0)
          log_pooler_errors         = tostring(var.pgbouncer_log_pooler_errors ? 1 : 0)
          application_name_add_host = tostring(var.pgbouncer_application_name_add_host ? 1 : 0)
          autodb_idle_timeout       = tostring(var.pgbouncer_autodb_idle_timeout)
          client_idle_timeout       = tostring(var.pgbouncer_client_idle_timeout)
          client_login_timeout      = tostring(var.pgbouncer_client_login_timeout)
          default_pool_size         = tostring(var.pgbouncer_default_pool_size)
          disable_pqexec            = tostring(var.pgbouncer_disable_pqexec ? 1 : 0)
          max_db_connections        = tostring(var.pgbouncer_max_db_connections)
          max_prepared_statements   = tostring(var.pgbouncer_max_prepared_statements)
          max_user_connections      = tostring(var.pgbouncer_max_user_connections)
          min_pool_size             = tostring(var.pgbouncer_min_pool_size)
          query_timeout             = tostring(var.pgbouncer_query_timeout)
          query_wait_timeout        = tostring(var.pgbouncer_query_wait_timeout)
          reserve_pool_size         = tostring(var.pgbouncer_reserve_pool_size)
          reserve_pool_timeout      = tostring(var.pgbouncer_reserve_pool_timeout)
          server_connect_timeout    = tostring(var.pgbouncer_server_connect_timeout)
          server_fast_close         = tostring(var.pgbouncer_server_fast_close ? 1 : 0)
          server_idle_timeout       = tostring(var.pgbouncer_server_idle_timeout)
          server_lifetime           = tostring(var.pgbouncer_server_lifetime)
          server_login_retry        = tostring(var.pgbouncer_server_login_retry)
          stats_period              = tostring(var.pgbouncer_stats_period)
          tcp_keepalive             = tostring(var.pgbouncer_tcp_keepalive ? 1 : 0)
          tcp_keepcnt               = var.pgbouncer_tcp_keepcnt == null ? null : tostring(var.pgbouncer_tcp_keepcnt)
          tcp_keepidle              = var.pgbouncer_tcp_keepidle == null ? null : tostring(var.pgbouncer_tcp_keepidle)
          tcp_keepintvl             = var.pgbouncer_tcp_keepintvl == null ? null : tostring(var.pgbouncer_tcp_keepintvl)
          tcp_user_timeout          = tostring(var.pgbouncer_tcp_user_timeout ? 1 : 0)
          verbose                   = tostring(var.pgbouncer_verbose)
        } : k => v if v != null }
      }
      monitoring = {
        enablePodMonitor = var.monitoring_enabled
      }
      template = {
        metadata = {
          labels = module.util_pooler[each.key].labels
          annotations = {
            "linkerd.io/skip-inbound-ports" = "5432" # Postgres communication is already tls-secured by CNPG
          }
        }
        spec = {
          containers = [
            {
              name  = "pgbouncer"
              image = "${module.pull_through.github_registry}/cloudnative-pg/pgbouncer:${var.pgbouncer_version}"

              // Running this as a prestop hook ensures that the open connections can be drained
              // prior to disconnecting the network interface from the pods. This reduces connection errors
              // when a pooler pod is terminated
              lifecycle = {
                preStop = {
                  exec = {
                    command = ["/bin/sh", "-c", "killall -INT pgbouncer && sleep 120"]
                  }
                }
              }

              resources = {
                requests = {
                  cpu    = "${var.pgbouncer_minimum_cpu_millicores}m"
                  memory = "${var.pgbouncer_minimum_memory_mb}Mi"
                }
                limits = {
                  memory = "${ceil(var.pgbouncer_minimum_memory_mb * 1.2)}Mi"
                }
              }
            }
          ]
          schedulerName             = module.util_pooler[each.key].scheduler_name
          priorityClassName         = module.constants.workload_important_priority_class_name
          topologySpreadConstraints = module.util_pooler[each.key].topology_spread_constraints
          tolerations               = module.util_pooler[each.key].tolerations
          affinity                  = module.util_pooler[each.key].affinity
        }
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubernetes_manifest.postgres_cluster, module.pooler_certs]
}


resource "kubectl_manifest" "vpa_pooler" {
  for_each = var.vpa_enabled ? local.poolers_to_enable : []
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "${local.cluster_name}-pooler-${each.key}"
      namespace = var.pg_cluster_namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      targetRef = {
        apiVersion = "postgresql.cnpg.io/v1"
        kind       = "Pooler"
        name       = "${local.cluster_name}-pooler-${each.key}"
      }
      resourcePolicy = {
        containerPolicies = [{
          containerName = "pgbouncer"
          minAllowed = {
            cpu    = "${var.pgbouncer_minimum_cpu_millicores}m"
            memory = "${var.pgbouncer_minimum_memory_mb}Mi"
          }
          maxAllowed = {
            cpu    = "${var.pgbouncer_maximum_cpu_millicores}m"
            memory = "${var.pgbouncer_maximum_memory_mb}Mi"
          }
        }]
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.connection_pooler]
}

resource "kubectl_manifest" "pdb_pooler" {
  for_each = local.poolers_to_enable
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.cluster_name}-pooler-${each.key}"
      namespace = var.pg_cluster_namespace
      labels = merge(
        module.util_pooler[each.key].labels,
        local.disruption_window_labels
      )
      annotations = local.disruption_window_annotations
    }
    spec = {
      selector = {
        matchLabels = module.util_pooler[each.key].match_labels
      }
      maxUnavailable = var.voluntary_disruptions_enabled && !var.voluntary_disruption_window_enabled ? 1 : 0
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.connection_pooler]
  ignore_fields = concat(
    [
      "metadata.annotations.panfactum.com/voluntary-disruption-window-start"
    ],
    var.voluntary_disruption_window_enabled ? [
      "spec.maxUnavailable"
    ] : []
  )
}

/***************************************
* Disruption Management
***************************************/

module "disruption_window_controller" {
  count  = var.voluntary_disruption_window_enabled ? 1 : 0
  source = "../kube_disruption_window_controller"

  namespace                   = var.pg_cluster_namespace
  vpa_enabled                 = var.vpa_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled

  cron_schedule = var.voluntary_disruption_window_cron_schedule
}

// This policy updates the PDB to prevent cluster disruptions when a backup is running
resource "kubectl_manifest" "backup_pdb" {
  count = var.voluntary_disruptions_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "Policy"
    metadata = {
      name      = "backup-pdb-${local.cluster_name}"
      namespace = var.pg_cluster_namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      useServerSideApply = true
      rules = [
        // This rule re-enables disruptions if no backups are running
        {
          name = "allow-disruptions"
          match = {
            any = [{
              resources = {
                kinds = ["postgresql.cnpg.io/v1/Backup"]
              }
            }]
          }
          preconditions = {
            all = [
              {
                key      = "{{ request.object.status.phase || 'running' }}"
                operator = "NotEquals"
                value    = "running"
              },
            ]
          }
          mutate = {
            mutateExistingOnPolicyUpdate = true
            targets = [
              {
                apiVersion = "policy/v1"
                kind       = "PodDisruptionBudget"
                name       = "${local.cluster_name}-pf-pdb"
                namespace  = var.pg_cluster_namespace

                // Don't update the PDB if the voluntary disruption window is active
                preconditions = {
                  all = [
                    {
                      key      = "{{ target.metadata.annotations.\"panfactum.com/voluntary-disruption-window-start\" || '' }}"
                      operator = "Equals"
                      value    = ""
                    }
                  ]
                }
              }
            ]

            patchStrategicMerge = {
              metadata = {
                labels = local.disruption_window_labels
              }
              spec = {
                maxUnavailable = var.voluntary_disruption_window_enabled ? 0 : 1
              }
            }
          }
        },
        // This rule disables disruptions if backups are running and takes precedence over the above rules
        {
          name = "block-disruptions"
          match = {
            any = [{
              resources = {
                kinds = ["postgresql.cnpg.io/v1/Backup"]
              }
            }]
          }
          preconditions = {
            all = [
              {
                key      = "{{ request.object.status.phase || 'running' }}"
                operator = "Equals"
                value    = "running"
              }
            ]
          }
          mutate = {
            mutateExistingOnPolicyUpdate = true
            targets = [
              {
                apiVersion = "policy/v1"
                kind       = "PodDisruptionBudget"
                name       = "${local.cluster_name}-pf-pdb"
                namespace  = var.pg_cluster_namespace
              }
            ]
            patchStrategicMerge = {
              metadata = {
                labels = {
                  "panfactum.com/voluntary-disruption-window-id" = "false"
                }
              }
              spec = {
                maxUnavailable = 0
              }
            }
          }
        }
      ]
    }
  })
  force_new         = true
  force_conflicts   = true
  server_side_apply = true
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      // Using the PDB name local.cluster-name will result in the operator deleting it
      // as we have disabled the operator pdb functionality
      name      = "${local.cluster_name}-pf-pdb"
      namespace = var.pg_cluster_namespace
      labels = merge(
        module.util_cluster.labels,
        local.disruption_window_labels
      )
      annotations = local.disruption_window_annotations
    }
    spec = {
      # If we haven't met the healthy budget, then disrupting nodes that attempting to recovery
      # might corrupt the datastore and force a need for manual intervention; as a result, do NOT
      # use AlwaysAllow here
      unhealthyPodEvictionPolicy = "IfHealthyBudget"
      selector = {
        matchLabels = module.util_cluster.match_labels
      }
      maxUnavailable = var.voluntary_disruptions_enabled && !var.voluntary_disruption_window_enabled ? 1 : 0
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubernetes_manifest.postgres_cluster]
  ignore_fields = [
    "metadata.annotations.panfactum.com/voluntary-disruption-window-start",
    "spec.maxUnavailable"
  ]
}


/***************************************
* Image Cache
***************************************/

module "image_cache" {
  count  = var.node_image_cached_enabled ? 1 : 0
  source = "../kube_node_image_cache"

  images = [
    {
      registry          = module.pull_through.github_registry
      repository        = "cloudnative-pg/postgresql"
      tag               = var.pg_version
      arm_nodes_enabled = var.arm_nodes_enabled
    }
  ]
}
