terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
  }
}

locals {
  cluster-label = "${var.pg_cluster_namespace}-${local.cluster_name}"

  cluster_name = random_id.cluster_id.hex

  smart_shutdown_timeout = var.pg_smart_shutdown_timeout != null ? var.pg_smart_shutdown_timeout : (var.burstable_instances_enabled || var.spot_instances_enabled ? 60 : 15 * 60)

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
  burstable_nodes_enabled              = var.burstable_instances_enabled
  spot_nodes_enabled                   = var.spot_instances_enabled
  arm_nodes_enabled                    = var.arm_instances_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  topology_spread_strict               = true
  topology_spread_enabled              = true // stateful so always on
  lifetime_evictions_enabled           = false

  # pf-generate: set_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "util_pooler" {
  for_each = toset(["r", "rw"])
  source   = "../kube_workload_utility"

  workload_name                        = "pg-rooler-${each.key}-${random_id.cluster_id.hex}"
  burstable_nodes_enabled              = true
  arm_nodes_enabled                    = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  topology_spread_enabled              = var.enhanced_ha_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  topology_spread_strict               = true
  pod_affinity_match_labels            = module.util_cluster.match_labels
  lifetime_evictions_enabled           = false

  # pf-generate: set_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "constants" {
  source = "../kube_constants"
}

/***************************************
* S3 Backup
***************************************/

resource "random_id" "bucket_name" {
  count       = var.backups_enabled ? 1 : 0
  byte_length = 8
  prefix      = "${var.pg_cluster_namespace}-${local.cluster_name}-backup-"
}

module "s3_bucket" {
  count  = var.backups_enabled ? 1 : 0
  source = "../aws_s3_private_bucket"

  bucket_name                     = random_id.bucket_name[0].hex
  description                     = "Backups for the ${local.cluster_name} cluster."
  versioning_enabled              = false
  audit_log_enabled               = false
  intelligent_transitions_enabled = false // db operator takes care of garbage collection
  force_destroy                   = var.backups_force_delete

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

data "aws_iam_policy_document" "s3_access" {
  count = var.backups_enabled ? 1 : 0
  statement {
    effect  = "Allow"
    actions = ["s3:*"]
    resources = [
      module.s3_bucket[0].bucket_arn,
      "${module.s3_bucket[0].bucket_arn}/*"
    ]
  }
}

module "irsa" {
  count  = var.backups_enabled ? 1 : 0
  source = "../kube_sa_auth_aws"

  eks_cluster_name          = var.eks_cluster_name
  service_account           = local.cluster_name
  service_account_namespace = var.pg_cluster_namespace
  iam_policy_json           = data.aws_iam_policy_document.s3_access[0].json
  ip_allow_list             = var.aws_iam_ip_allow_list

  // Due to a limitation in the cluster resource api, the cluster resource is the one that creates
  // the service account for us, so we let it to the annotations
  annotate_service_account = false

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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

  # pf-generate: pass_vars_no_extra_tags
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, {
    "cnpg.io/reload" = ""
  })
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

  # pf-generate: pass_vars_no_extra_tags
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, {
    "cnpg.io/reload" = ""
  })
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
    spec = merge({
      imageName             = "${module.pull_through.github_registry}/cloudnative-pg/postgresql:${var.pg_version}"
      instances             = var.pg_instances
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
          "resize.topolvm.io/storage_limit"      = "${var.pg_storage_limit_gb != null ? var.pg_storage_limit_gb : 10 * var.pg_initial_storage_gb}Gi"
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
          {
            # Defaults - Need to be provided to avoid reconciliation error
            archive_mode               = "on"
            archive_timeout            = "5min"
            dynamic_shared_memory_type = "posix"
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
            wal_keep_size              = "1024MB"
            wal_level                  = "logical"
            wal_log_hints              = "on"
            wal_receiver_timeout       = "5s"
            wal_sender_timeout         = "5s"

            # Memory tuning - Based on guide created bhy EDB (creators of CNPG)
            # https://www.enterprisedb.com/postgres-tutorials/how-tune-postgresql-memory
            max_connections      = var.pg_max_connections
            shared_buffers       = "${ceil(var.pg_memory_mb * var.pg_shared_buffers_percent / 100)}MB"
            work_mem             = "${max(ceil(var.pg_memory_mb * var.pg_work_mem_percent / 100 / var.pg_max_connections), 4)}MB"
            maintenance_work_mem = "${ceil(var.pg_memory_mb * var.pg_maintenance_work_mem_percent / 100)}MB"
            effective_cache_size = "${ceil(var.pg_memory_mb * max((100 - var.pg_work_mem_percent - var.pg_maintenance_work_mem_percent - 10), var.pg_shared_buffers_percent) / 100)}MB"
          },
          var.pg_parameters
        )
      }

      bootstrap = {
        initdb = {
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
            "GRANT CONNECT ON DATABASE postgres TO cnpg_pooler_pgbouncer;",
            "CREATE OR REPLACE FUNCTION user_search(uname TEXT) RETURNS TABLE (usename name, passwd text) LANGUAGE sql SECURITY DEFINER AS 'SELECT usename, passwd FROM pg_shadow WHERE usename=$1;'",
            "REVOKE ALL ON FUNCTION user_search(text) FROM public;",
            "GRANT EXECUTE ON FUNCTION user_search(text) TO cnpg_pooler_pgbouncer;"
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
            "CREATE OR REPLACE FUNCTION user_search(uname TEXT) RETURNS TABLE (usename name, passwd text) LANGUAGE sql SECURITY DEFINER AS 'SELECT usename, passwd FROM pg_shadow WHERE usename=$1;'",
            "REVOKE ALL ON FUNCTION user_search(text) FROM public;",
            "GRANT EXECUTE ON FUNCTION user_search(text) TO cnpg_pooler_pgbouncer;"
          ])
        }
      }

      priorityClassName = module.constants.database_priority_class_name

      // Try to spread the instances evenly across the availability zones
      topologySpreadConstraints = module.util_cluster.topology_spread_constraints

      affinity = {
        // Ensures that the postgres cluster instances are never scheduled on the same node
        enablePodAntiAffinity = true
        topologyKey           = (var.burstable_instances_enabled || var.spot_instances_enabled) ? "node.kubernetes.io/instance-type" : "kubernetes.io/hostname"
        podAntiAffinityType   = "required"

        // Allow the clusters to be scheduled on particular node types
        tolerations = module.util_cluster.tolerations
      }

      resources = {
        requests = {
          memory = "${var.pg_memory_mb}Mi"
          cpu    = "${var.pg_cpu_millicores}m"
        }
        limits = {
          memory = "${ceil(var.pg_memory_mb * 1.3)}Mi"
        }
      }

      storage = {
        pvcTemplate = {
          resources = {
            requests = {
              storage = "${var.pg_initial_storage_gb}Gi"
            }
          }
          storageClassName = "ebs-standard"
        }
      }
      }, var.backups_enabled ? {
      // Backups
      serviceAccountTemplate = {
        metadata = {
          annotations = {
            "eks.amazonaws.com/role-arn" = module.irsa[0].role_arn
          }
        }
      }
      backup = {
        barmanObjectStore = {
          destinationPath = "s3://${module.s3_bucket[0].bucket_name}/"
          s3Credentials = {
            inheritFromIAMRole = true
          }
          wal = {
            compression = "bzip2"
            maxParallel = 8
          }
          data = {
            compression = "bzip2"
            jobs        = 8
          }
        }
        retentionPolicy = "7d"
      }
    } : null)
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

  depends_on = [module.client_certs, module.server_certs]
}

resource "kubectl_manifest" "scheduled_backup" {
  count = var.backups_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "ScheduledBackup"
    metadata = {
      name      = "${local.cluster_name}-default"
      namespace = var.pg_cluster_namespace
    }
    spec = {
      schedule             = var.backups_cron_schedule
      backupOwnerReference = "cluster"
      cluster = {
        name = local.cluster_name
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubernetes_manifest.postgres_cluster]
}

# TODO: Re-enable once https://github.com/cloudnative-pg/cloudnative-pg/issues/2574 is addressed
#resource "kubernetes_manifest" "vpa" {
#  count = var.vpa_enabled ? 1: 0
#  manifest = {
#    apiVersion = "autoscaling.k8s.io/v1"
#    kind  = "VerticalPodAutoscaler"
#    metadata = {
#      name = local.cluster_name
#      namespace = var.pg_cluster_namespace
#      labels = module.kube_labels.kube_labels
#    }
#    spec = {
#      targetRef = {
#        apiVersion = "postgresql.cnpg.io/v1"
#        kind = "Cluster"
#        name = local.cluster_name
#      }
#      updatePolicy = {
#        updateMode = "Auto"
#      }
#    }
#  }
#  depends_on = [kubernetes_manifest.postgres_cluster]
#}

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
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_cluster.match_labels
      }
      maxUnavailable = var.voluntary_disruptions_enabled && !var.voluntary_disruption_window_enabled ? 1 : 0
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubernetes_manifest.postgres_cluster]
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
  default_ttl = 60 * 60 * 8
  max_ttl     = 60 * 60 * 8
}

resource "vault_database_secret_backend_role" "admin" {
  backend = "db"
  name    = "admin-${var.pg_cluster_namespace}-${local.cluster_name}"
  db_name = vault_database_secret_backend_connection.postgres.name
  creation_statements = flatten([
    // We have to re-run the generic grant commands
    // on every login to make sure we have picked up new objects
    [for schema in local.all_schemas : [
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
  default_ttl = 60 * 60 * 8
  max_ttl     = 60 * 60 * 8
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

  default_ttl = 60 * 60 * 8
  max_ttl     = 60 * 60 * 8
}

resource "vault_database_secret_backend_connection" "postgres" {
  backend = "db"
  name    = "${var.pg_cluster_namespace}-${local.cluster_name}"
  allowed_roles = [
    "reader-${var.pg_cluster_namespace}-${local.cluster_name}",
    "admin-${var.pg_cluster_namespace}-${local.cluster_name}",
    "superuser-${var.pg_cluster_namespace}-${local.cluster_name}"
  ]

  postgresql {
    connection_url = "postgres://postgres:${random_password.superuser_password.result}@${local.cluster_name}-rw.${var.pg_cluster_namespace}:5432/app"
  }

  verify_connection = false

  depends_on = [kubernetes_manifest.postgres_cluster]
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
  source      = "../kube_internal_cert"
  secret_name = random_id.pooler_secret.hex
  namespace   = var.pg_cluster_namespace
  usages      = ["client auth"]
  common_name = "cnpg_pooler_pgbouncer"

  # pf-generate: pass_vars_no_extra_tags
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, {
    "cnpg.io/reload" = ""
  })
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
        authQuery = "SELECT usename, passwd FROM user_search($1)"
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
                  memory = "50Mi"
                }
                limits = {
                  memory = "80Mi"
                }
              }
            }
          ]
          schedulerName             = module.util_pooler[each.key].scheduler_name
          priorityClassName         = module.constants.database_priority_class_name
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


# TODO: These will not work until
# https://github.com/cloudnative-pg/cloudnative-pg/issues/4210
# is resovled
#resource "kubernetes_manifest" "vpa_pooler" {
#  for_each = var.vpa_enabled ? toset(["r", "rw"]) : []
#  manifest = {
#    apiVersion = "autoscaling.k8s.io/v1"
#    kind  = "VerticalPodAutoscaler"
#    metadata = {
#      name      = "${local.cluster_name}-pooler-${each.key}"
#      namespace = var.pg_cluster_namespace
#      labels    = module.kube_labels_pooler[each.key].kube_labels
#    }
#    spec = {
#      targetRef = {
#        apiVersion = "postgresql.cnpg.io/v1"
#        kind = "Pooler"
#        name = "${local.cluster_name}-pooler-${each.key}"
#      }
#    }
#  }
#  depends_on = [kubernetes_manifest.connection_pooler]
#}

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
* Disruption Windows
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
