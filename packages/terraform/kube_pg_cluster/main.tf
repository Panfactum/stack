// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
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

  cluster_match_labels = {
    id = random_id.cluster_id.hex
  }

  pooler_rw_match_labels = {
    id = random_id.pooler_rw_id.hex
  }

  pooler_r_match_labels = {
    id = random_id.pooler_r_id.hex
  }
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
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

module "kube_labels" {
  source = "../kube_labels"

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = merge(var.extra_tags, local.cluster_match_labels)
}

module "kube_labels_pooler" {
  for_each = toset(["r", "rw"])
  source   = "../kube_labels"

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = merge(var.extra_tags, local.pooler_r_match_labels)
}

module "constants" {
  source = "../constants"

  matching_labels = local.cluster_match_labels

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "constants_pooler" {
  for_each = toset(["r", "rw"])
  source   = "../constants"

  matching_labels = local.pooler_rw_match_labels

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
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

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
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
  ip_allow_list             = var.ip_allow_list

  // Due to a limitation in the cluster resource api, the cluster resource is the one that creates
  // the service account for us, so we let it to the annotations
  annotate_service_account = false

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
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

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
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

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
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
      labels    = module.kube_labels.kube_labels
      annotations = {
        // We cannot disable native postgres tls encryption in this operator
        // so we will disable our service mesh overlay
        "linkerd.io/inject" = "disabled"

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
      imageName             = "${var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"}/cloudnative-pg/postgresql:${var.pg_version}"
      instances             = var.pg_instances
      primaryUpdateStrategy = "unsupervised"
      primaryUpdateMethod   = "switchover"

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
        labels = merge(module.kube_labels.kube_labels, {
          pg-cluster = local.cluster-label
        })
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
            "GRANT ALL PRIVILEGES ON SCHEMA public TO cnpg_pooler_pgbouncer;",
            "GRANT CONNECT ON DATABASE postgres TO cnpg_pooler_pgbouncer;",
            "CREATE OR REPLACE FUNCTION user_search(uname TEXT) RETURNS TABLE (usename name, passwd text) LANGUAGE sql SECURITY DEFINER AS 'SELECT usename, passwd FROM pg_shadow WHERE usename=$1;'",
            "REVOKE ALL ON FUNCTION user_search(text) FROM public;",
            "GRANT EXECUTE ON FUNCTION user_search(text) TO cnpg_pooler_pgbouncer;"
          ]
          postInitApplicationSQL = [

            // See above
            "REVOKE ALL ON SCHEMA public FROM PUBLIC;",

            // Creates the user groups that we assign dynamic roles to
            "CREATE ROLE reader NOINHERIT;",
            "GRANT pg_read_all_data TO reader;",
            "GRANT USAGE ON SCHEMA public TO reader;",

            "CREATE ROLE writer NOINHERIT;",
            "GRANT pg_write_all_data, pg_read_all_data TO writer;",
            "GRANT ALL PRIVILEGES ON SCHEMA public TO writer;",

            // Grant privileges to pgbouncer
            "GRANT CONNECT ON DATABASE app TO cnpg_pooler_pgbouncer;",
            "GRANT ALL PRIVILEGES ON SCHEMA public TO cnpg_pooler_pgbouncer;",
            "CREATE OR REPLACE FUNCTION user_search(uname TEXT) RETURNS TABLE (usename name, passwd text) LANGUAGE sql SECURITY DEFINER AS 'SELECT usename, passwd FROM pg_shadow WHERE usename=$1;'",
            "REVOKE ALL ON FUNCTION user_search(text) FROM public;",
            "GRANT EXECUTE ON FUNCTION user_search(text) TO cnpg_pooler_pgbouncer;"
          ]
        }
      }

      priorityClassName = module.constants.database_priority_class_name

      // Try to spread the instances evenly across the availability zones
      topologySpreadConstraints = module.constants.topology_spread_zone_strict

      affinity = {
        // Ensures that the postgres cluster instances are never scheduled on the same node
        enablePodAntiAffinity = true
        topologyKey           = "kubernetes.io/hostname"
        podAntiAffinityType   = "required"
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
          accessModes = ["ReadWriteOnce"]
          resources = {
            requests = {
              storage = "${var.pg_storage_gb}Gi"
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
}

resource "kubernetes_manifest" "scheduled_backup" {
  count = var.backups_enabled ? 1 : 0
  manifest = {
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "ScheduledBackup"
    metadata = {
      name      = "${local.cluster_name}-weekly"
      namespace = var.pg_cluster_namespace
    }
    spec = {
      schedule             = "0 3 * * 1" // 3AM on sundays
      backupOwnerReference = "cluster"
      cluster = {
        name = local.cluster_name
      }
    }
  }
  depends_on = [kubernetes_manifest.postgres_cluster]
}

# TODO: Re-enable once https://github.com/cloudnative-pg/cloudnative-pg/issues/2574 is addressed
#resource "kubernetes_manifest" "vpa_dbs" {
#  count = var.vpa_enabled ? 1: 0
#  manifest = {
#    apiVersion = "autoscaling.k8s.io/v1"
#    kind  = "VerticalPodAutoscaler"
#    metadata = {
#      name = var.pg_cluster_name
#      namespace = var.pg_cluster_namespace
#      labels = module.kube_labels.kube_labels
#    }
#    spec = {
#      targetRef = {
#        apiVersion = "postgresql.cnpg.io/v1"
#        kind = "Cluster"
#        name = var.pg_cluster_name
#      }
#      updatePolicy = {
#        updateMode = "Auto"
#      }
#    }
#  }
#  depends_on = [kubernetes_manifest.postgres_cluster]
#}

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
  creation_statements = [
    // We have to re-run the generic grant commands
    // on every login to make sure we have picked up new objects
    "GRANT SELECT ON ALL TABLES IN SCHEMA public TO reader;",
    "GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO reader;",
    "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO reader;",

    // Create the temporary role and assign them to the reader group
    "CREATE ROLE \"{{name}}\" LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",
    "GRANT reader TO \"{{name}}\";"
  ]
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
  creation_statements = [
    // We have to re-run the generic grant commands
    // on every login to make sure we have picked up new objects
    "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO writer;",
    "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO writer;",
    "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO writer;",

    // Create the temporary role and assign them to the writer group
    "CREATE ROLE \"{{name}}\" LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",
    "GRANT writer TO \"{{name}}\";",

    // Ensure that new objects this role generates propagate permissions to the other roles
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO writer;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO writer;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO writer;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT ALL PRIVILEGES ON TYPES TO writer;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT SELECT ON TABLES TO reader;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT SELECT ON SEQUENCES TO reader;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO reader;"
  ]
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
  creation_statements = [
    "CREATE ROLE \"{{name}}\" SUPERUSER LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",

    // Ensure that new objects this role generates propagate permissions to the other roles
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO writer;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO writer;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO writer;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT ALL PRIVILEGES ON TYPES TO writer;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT SELECT ON TABLES TO reader;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"{{name}}\" IN SCHEMA public GRANT SELECT ON SEQUENCES TO reader;",
  ]
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

  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags = merge(var.extra_tags, {
    "cnpg.io/reload" = ""
  })
}


resource "kubernetes_manifest" "connection_pooler" {
  for_each = toset(["rw", "r"])
  manifest = {
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "Pooler"
    metadata = {
      name      = "${local.cluster_name}-pooler-${each.key}"
      namespace = var.pg_cluster_namespace
      labels    = module.kube_labels_pooler[each.key].kube_labels
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
        parameters = {
          log_connections    = var.log_connections_enabled ? 1 : 0
          log_disconnections = var.log_connections_enabled ? 1 : 0
        }
      }
      template = {
        metadata = {
          labels = module.kube_labels_pooler[each.key].kube_labels
          annotations = {
            "linkerd.io/inject" = "disabled"
          }
        }
        spec = {
          containers = [
            {
              name  = "pgbouncer"
              image = "${var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"}/cloudnative-pg/pgbouncer:${var.pgbouncer_version}"

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

          priorityClassName         = module.constants.database_priority_class_name
          topologySpreadConstraints = module.constants_pooler[each.key].topology_spread_zone_preferred
          tolerations               = module.constants_pooler[each.key].burstable_node_toleration_helm
          affinity = merge(
            module.constants_pooler[each.key].pod_anti_affinity_helm,
            {
              podAffinity = {
                // Try to schedule poolers on the same nodes as db instances to reduce network latency
                preferredDuringSchedulingIgnoredDuringExecution = [
                  {
                    weight = 100
                    podAffinityTerm = {
                      labelSelector = {
                        matchExpressions = [
                          {
                            key      = "id"
                            operator = "In"
                            values   = [random_id.cluster_id.hex]
                          }
                        ]
                      }
                      topologyKey = "kubernetes.io/hostname"
                    }
                  }
                ]
              },
            }
          )
        }
      }
    }
  }

  depends_on = [kubernetes_manifest.postgres_cluster]
}


# TODO: These will not work until
# https://github.com/cloudnative-pg/cloudnative-pg/issues/4210
# is resovled
#resource "kubernetes_manifest" "vpa_pooler_rw" {
#  count = var.vpa_enabled ? 1 : 0
#  manifest = {
#    apiVersion = "autoscaling.k8s.io/v1"
#    kind  = "VerticalPodAutoscaler"
#    metadata = {
#      name = "${local.cluster_name}-pooler-rw"
#      namespace = var.pg_cluster_namespace
#      labels = module.kube_labels_pooler_rw.kube_labels
#    }
#    spec = {
#      targetRef = {
#        apiVersion = "postgresql.cnpg.io/v1"
#        kind = "Pooler"
#        name = "${local.cluster_name}-pooler-rw"
#      }
#    }
#  }
#  depends_on = [kubernetes_manifest.connection_pooler_rw]
#}
#
#resource "kubernetes_manifest" "vpa_pooler_rr" {
#  count = var.vpa_enabled ? 1 : 0
#  manifest = {
#    apiVersion = "autoscaling.k8s.io/v1"
#    kind  = "VerticalPodAutoscaler"
#    metadata = {
#      name = "${local.cluster_name}-pooler-r"
#      namespace = var.pg_cluster_namespace
#      labels = module.kube_labels_pooler_r.kube_labels
#    }
#    spec = {
#      targetRef = {
#        apiVersion = "postgresql.cnpg.io/v1"
#        kind = "Pooler"
#        name = "${local.cluster_name}-pooler-r"
#      }
#    }
#  }
#  depends_on = [kubernetes_manifest.connection_pooler_r]
#}

resource "kubernetes_manifest" "pdb_pooler" {
  for_each = toset(["r", "rw"])
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.cluster_name}-pooler-${each.key}"
      namespace = var.pg_cluster_namespace
      labels    = module.kube_labels_pooler[each.key].kube_labels
    }
    spec = {
      selector = {
        matchLabels = each.key == "r" ? local.pooler_r_match_labels : local.pooler_rw_match_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [kubernetes_manifest.connection_pooler]
}
