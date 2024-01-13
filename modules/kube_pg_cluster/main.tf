terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.10"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.5.1"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.9.1"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.19.0"
    }
  }
}

locals {
  cluster-label = "${var.pg_cluster_namespace}-${var.pg_cluster_name}"
  pooler-label  = "${local.cluster-label}-pooler-rw"
}

module "constants" {
  source = "../constants"
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* S3 Backup
***************************************/

resource "random_id" "bucket_name" {
  count       = var.backups_enabled ? 1 : 0
  byte_length = 8
  prefix      = "${var.pg_cluster_name}-backups-"
}

module "s3_bucket" {
  count                           = var.backups_enabled ? 1 : 0
  source                          = "../aws_s3_private_bucket"
  bucket_name                     = random_id.bucket_name[0].hex
  description                     = "Backups for the ${var.pg_cluster_name} cluster."
  versioning_enabled              = false
  audit_log_enabled               = true
  intelligent_transitions_enabled = false // db operator takes care of garbage collection
  force_destroy                   = var.backups_force_delete
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
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
  count                     = var.backups_enabled ? 1 : 0
  source                    = "../kube_sa_auth_aws"
  eks_cluster_name          = var.eks_cluster_name
  service_account           = var.pg_cluster_name
  service_account_namespace = var.pg_cluster_namespace
  iam_policy_json           = data.aws_iam_policy_document.s3_access[0].json
  public_outbound_ips       = var.public_outbound_ips

  // Due to a limitation in the cluster resource api, the cluster resource is the one that creates
  // the service account for us, so we let it to the annotations
  annotate_service_account = false
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* Certs
***************************************/

resource "random_id" "server_certs_secret" {
  prefix      = "pg-server-certs-"
  byte_length = 8
}

module "server_certs" {
  source      = "../kube_internal_cert"
  secret_name = random_id.server_certs_secret.hex
  namespace   = var.pg_cluster_namespace
  labels      = var.kube_labels
  service_names = [
    var.pg_cluster_name,
    "${var.pg_cluster_name}-rw",
    "${var.pg_cluster_name}-r",
    "${var.pg_cluster_name}-ro"
  ]
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

resource "kubernetes_labels" "server_certs" {
  api_version = "v1"
  kind        = "Secret"
  metadata {
    name      = random_id.server_certs_secret.hex
    namespace = var.pg_cluster_namespace
  }
  labels = {
    "cnpg.io/reload" : ""
  }
  depends_on = [module.server_certs]
}

resource "random_id" "client_certs_secret" {
  prefix      = "pg-client-certs-"
  byte_length = 8
}

module "client_certs" {
  source      = "../kube_internal_cert"
  secret_name = random_id.client_certs_secret.hex
  namespace   = var.pg_cluster_namespace
  labels      = var.kube_labels
  usages      = ["client auth"]
  common_name = "streaming_replica"
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

resource "kubernetes_labels" "client_certs" {
  api_version = "v1"
  kind        = "Secret"
  metadata {
    name      = random_id.client_certs_secret.hex
    namespace = var.pg_cluster_namespace
  }
  labels = {
    "cnpg.io/reload" : ""
  }
  depends_on = [module.client_certs]
}


/***************************************
* Cluster
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
    name      = "${var.pg_cluster_name}-superuser-${sha256(random_password.superuser_password.result)}"
    namespace = var.pg_cluster_namespace
  }

  data = {
    password = random_password.superuser_password.result
    pgpass   = "${var.pg_cluster_name}-rw:5432:*:postgres:${random_password.superuser_password.result}"
    username = "postgres"
  }
}


resource "kubernetes_manifest" "postgres_cluster" {
  manifest = {
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "Cluster"
    metadata = {
      name      = var.pg_cluster_name
      namespace = var.pg_cluster_namespace
      labels    = var.kube_labels
      annotations = {
        // We cannot disable native postgres tls encryption in this operator
        // so we will disable our service mesh overlay
        "linkerd.io/inject" = "disabled"
      }
    }
    spec = merge({
      imageName             = "ghcr.io/cloudnative-pg/postgresql:${var.pg_version}"
      instances             = var.pg_instances
      primaryUpdateStrategy = "unsupervised"
      primaryUpdateMethod   = "switchover"

      superuserSecret = {
        name = kubernetes_secret.superuser.metadata[0].name
      }

      certificates = {
        serverTLSSecret = random_id.server_certs_secret.hex
        serverCASecret  = random_id.server_certs_secret.hex
        #        clientCASecret = random_id.client_certs_secret.hex
        #        replicationTLSSecret = random_id.client_certs_secret.hex
      }

      inheritedMetadata = {
        labels = merge(var.kube_labels, {
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
          ]
        }
      }

      priorityClassName = module.constants.database_priority_class_name

      // Try to spread the instances evenly across the availability zones
      topologySpreadConstraints = [{
        maxSkew           = 1
        topologyKey       = "topology.kubernetes.io/zone"
        whenUnsatisfiable = "DoNotSchedule"
        labelSelector = {
          matchLabels = {
            pg-cluster = local.cluster-label
          }
        }
      }]

      affinity = {
        // Ensures that the postgres cluster instances are never scheduled on the same node
        enablePodAntiAffinity = true
        topologyKey           = "kubernetes.io/hostname"
        podAntiAffinityType   = "required"
      }

      storage = {
        pvcTemplate = {
          accessModes = ["ReadWriteOnce"]
          resources = {
            requests = {
              storage = "${var.pg_storage_gb}Gi"
            }
          }
          storageClassName = var.backups_enabled ? "ebs-standard-retained" : "ebs-standard"
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

  depends_on = [
    module.server_certs,
    module.client_certs
  ]
}

resource "kubernetes_manifest" "scheduled_backup" {
  manifest = {
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "ScheduledBackup"
    metadata = {
      name      = "${var.pg_cluster_name}-weekly"
      namespace = var.pg_cluster_namespace
    }
    spec = {
      schedule             = "0 3 * * 1" // 3AM on sundays
      backupOwnerReference = "cluster"
      cluster = {
        name = var.pg_cluster_name
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
#      labels = var.kube_labels
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

resource "vault_database_secret_backend_role" "read_only" {
  backend = "db"
  name    = "reader-${var.pg_cluster_namespace}-${var.pg_cluster_name}"
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
  default_ttl = 60 * 60 * 24
  max_ttl     = 60 * 60 * 24
}

resource "vault_database_secret_backend_role" "writer" {
  backend = "db"
  name    = "writer-${var.pg_cluster_namespace}-${var.pg_cluster_name}"
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
  default_ttl = 60 * 60 * 24
  max_ttl     = 60 * 60 * 24
}

resource "vault_database_secret_backend_role" "admin" {
  backend = "db"
  name    = "admin-${var.pg_cluster_namespace}-${var.pg_cluster_name}"
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

  // TODO: Limit admin creds to only an hour
  default_ttl = 60 * 60 * 24
  max_ttl     = 60 * 60 * 24
}

resource "vault_database_secret_backend_connection" "postgres" {
  backend = "db"
  name    = "${var.pg_cluster_namespace}-${var.pg_cluster_name}"
  allowed_roles = [
    "reader-${var.pg_cluster_namespace}-${var.pg_cluster_name}",
    "writer-${var.pg_cluster_namespace}-${var.pg_cluster_name}",
    "admin-${var.pg_cluster_namespace}-${var.pg_cluster_name}"
  ]

  postgresql {
    connection_url = "postgres://postgres:${random_password.superuser_password.result}@${var.pg_cluster_name}-rw.${var.pg_cluster_namespace}:5432/app"
  }

  verify_connection = false

  depends_on = [kubernetes_manifest.postgres_cluster]
}

/***************************************
* Connection Poolers
***************************************/
// TODO: The bouncer does not appear to work well
// when we are using our own credentials
#resource "time_rotating" "bouncer_rotation" {
#  rotation_days = 7
#}
#
#resource "random_password" "bouncer_password" {
#  length = 64
#  special = false
#  keepers = {
#    rotate = time_rotating.bouncer_rotation.id
#  }
#}
#
#resource "kubernetes_secret" "bouncer" {
#  type = "kubernetes.io/basic-auth"
#  metadata {
#    name = "${var.pg_cluster_name}-bouncer"
#    namespace = var.pg_cluster_namespace
#  }
#
#  data = {
#    password = random_password.bouncer_password.result
#    pgpass = "${var.pg_cluster_name}-rw:5432:*:cnpg_pooler_pgbonucer:${random_password.bouncer_password.result}"
#    username = "cnpg_pooler_pgbonucer"
#  }
#}
#
#resource "kubernetes_manifest" "connection_pooler_rw" {
#  manifest = {
#    apiVersion = "postgresql.cnpg.io/v1"
#    kind = "Pooler"
#    metadata = {
#      name = "${var.pg_cluster_name}-pooler-rw"
#      namespace = var.pg_cluster_namespace
#    }
#    spec = {
#      cluster = {
#        name = var.pg_cluster_name
#      }
#      instances = var.pg_instances
#      type = "rw"
#      pgbouncer = {
#        authQuerySecret = {
#          name = kubernetes_secret.bouncer.metadata[0].name
#        }
#        authQuery = "SELECT usename, passwd FROM user_search($1)"
#        poolMode = "session"
#      }
#      template = {
#        metadata = {
#          labels = {
#            pg-pooler = local.pooler-label
#          }
#        }
#        spec = {
#          containers = []
#
#          priorityClassName = module.constants.database_priority_class_name
#
#          // Try to spread the poolers evenly across the availability zones
#          topologySpreadConstraints = [{
#            maxSkew = 1
#            topologyKey = "topology.kubernetes.io/zone"
#            whenUnsatisfiable = var.ha_enabled ? "DoNotSchedule" :"ScheduleAnyway"
#            labelSelector = {
#              matchLabels = {
#                pg-pooler = local.pooler-label
#              }
#            }
#          }]
#
#          affinity = {
#            podAffinity = {
#              // Try to schedule poolers on the same nodes as db instances to reduce network latency
#              preferredDuringSchedulingIgnoredDuringExecution = [{
#                weight = 100
#                podAffinityTerm = {
#                  labelSelector = {
#                    matchExpressions =[{
#                      key = "pg-cluster"
#                      operator = "In"
#                      values = [local.cluster-label]
#                    }]
#                  }
#                  topologyKey = "kubernetes.io/hostname"
#                }
#              }]
#            }
#            podAntiAffinity = {
#              // Don't put multiple poolers on the same node
#              requiredDuringSchedulingIgnoredDuringExecution = var.ha_enabled ? [{
#                labelSelector = {
#                  matchExpressions = [{
#                    key = "pg-pooler"
#                    operator = "In"
#                    values = [local.pooler-label]
#                  }]
#                }
#                topologyKey = "kubernetes.io/hostname"
#              }] : []
#            }
#          }
#        }
#      }
#    }
#  }
#
#  wait {
#    condition {
#      type = "Ready"
#      status = "True"
#    }
#  }
#
#  depends_on = [kubernetes_manifest.postgres_cluster]
#}
#
#resource "kubernetes_manifest" "vpa" {
#  count = var.vpa_enabled ? 1 : 0
#  manifest = {
#    apiVersion = "autoscaling.k8s.io/v1"
#    kind  = "VerticalPodAutoscaler"
#    metadata = {
#      name = "${var.pg_cluster_name}-pooler-rw"
#      namespace = var.pg_cluster_namespace
#      labels = var.kube_labels
#    }
#    spec = {
#      targetRef = {
#        apiVersion = "apps/v1"
#        kind = "Deployment"
#        name = "${var.pg_cluster_name}-pooler-rw"
#      }
#    }
#  }
#  depends_on = [kubernetes_manifest.connection_pooler_rw]
#}

