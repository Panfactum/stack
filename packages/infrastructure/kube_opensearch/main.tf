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
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  sla_target = data.pf_metadata.metadata.sla_target
  pvc_group  = "${var.namespace}.${local.cluster_name}"

  security_config = yamlencode({
    _meta = {
      type           = "config"
      config_version = 2
    }
    config = {
      dynamic = {
        http = {
          anonymous_auth_enabled = false
        }
        authc = {
          clientcert_auth_domain = {
            http_enabled      = true
            transport_enabled = true
            order             = 1
            http_authenticator = {
              type = "clientcert"
              config = {
                username_attribute = "cn"
              }
              challenge = false
            }
            authentication_backend = {
              type = "noop"
            }
          }
        }
      }
    }
  })

  role_mappings = yamlencode({
    _meta = {
      type           = "rolesmapping"
      config_version = 2
    }

    // Superuser perms
    all_access = {
      reserved = true
      users    = ["superuser.${local.cluster_name}.${var.namespace}"]
    }
    security_manager = {
      reserved = true
      users    = ["superuser.${local.cluster_name}.${var.namespace}"]
    }
    cross_cluster_replication_follower_full_access = {
      reserved = true
      users    = ["superuser.${local.cluster_name}.${var.namespace}"]
    }
    cross_cluster_replication_leader_full_access = {
      reserved = true
      users    = ["superuser.${local.cluster_name}.${var.namespace}"]
    }
    security_analytics_full_access = {
      reserved = true
      users    = ["superuser.${local.cluster_name}.${var.namespace}"]
    }
    point_in_time_full_access = {
      reserved = true
      users    = ["superuser.${local.cluster_name}.${var.namespace}"]
    }

    // Admin perms
    asynchronous_search_full_access = {
      reserved = true
      users    = ["admin.${local.cluster_name}.${var.namespace}"]
    }
    alerting_full_access = {
      reserved = true
      users    = ["admin.${local.cluster_name}.${var.namespace}"]
    }
    index_management_full_access = {
      reserved = true
      users    = ["admin.${local.cluster_name}.${var.namespace}"]
    }
    notifications_full_access = {
      reserved = true
      users    = ["admin.${local.cluster_name}.${var.namespace}"]
    }
    opensearch_dashboards_user = {
      reserved = true
      users    = ["admin.${local.cluster_name}.${var.namespace}"]
    }
    ml_full_access = {
      reserved = true
      users    = ["admin.${local.cluster_name}.${var.namespace}"]
    }
    anomaly_full_access = {
      reserved = true
      users    = ["admin.${local.cluster_name}.${var.namespace}"]
    }
    snapshot_management_full_access = {
      reserved = true
      users    = ["admin.${local.cluster_name}.${var.namespace}"]
    }

    // Reader perms
    alerting_read_access = {
      reserved = true
      users    = ["reader.${local.cluster_name}.${var.namespace}"]
    }
    index_management_read_access = {
      reserved = true
      users    = ["reader.${local.cluster_name}.${var.namespace}"]
    }
    opensearch_dashboards_read_only = {
      reserved = true
      users    = ["reader.${local.cluster_name}.${var.namespace}"]
    }
    readall = {
      reserved = true
      users    = ["reader.${local.cluster_name}.${var.namespace}"]
    }
    security_analytics_read_access = {
      reserved = true
      users    = ["reader.${local.cluster_name}.${var.namespace}"]
    }
    asynchronous_search_read_access = {
      reserved = true
      users    = ["reader.${local.cluster_name}.${var.namespace}"]
    }
    ml_read_access = {
      reserved = true
      users    = ["reader.${local.cluster_name}.${var.namespace}"]
    }
    anomaly_read_access = {
      reserved = true
      users    = ["reader.${local.cluster_name}.${var.namespace}"]
    }
    notifications_read_access = {
      reserved = true
      users    = ["reader.${local.cluster_name}.${var.namespace}"]
    }
    snapshot_management_read_access = {
      reserved = true
      users    = ["reader.${local.cluster_name}.${var.namespace}"]
    }


    // Special
    security_analytics_read_access = {
      reserved = true
      users = [
        "admin.${local.cluster_name}.${var.namespace}",
        "reader.${local.cluster_name}.${var.namespace}"
      ]
    }

  })

  security_hash = md5("${local.role_mappings}${local.security_config}")

  cluster_name = random_id.id.hex
}

resource "random_id" "id" {
  byte_length = 2
  prefix      = "opensearch-"
}

data "pf_kube_labels" "labels" {
  module = "kube_opensearch"
}

data "pf_metadata" "metadata" {}

module "util" {
  source = "../kube_workload_utility"

  workload_name                        = local.cluster_name
  controller_nodes_enabled             = var.controller_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required != null ? var.instance_type_anti_affinity_required : local.sla_target == 3
  host_anti_affinity_required          = local.sla_target >= 2
  az_spread_required                   = true
  az_spread_preferred                  = true // stateful
  lifetime_evictions_enabled           = false
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

/***************************************
* Root Password
***************************************/

// TODO: Figure out a way to rotate this automatically
resource "random_password" "root_password" {
  length  = 64
  special = false
}


/***************************************
* Node Certificates
***************************************/

module "node_certs" {
  source                = "../kube_internal_cert"
  namespace             = var.namespace
  secret_name           = "${local.cluster_name}-node-certs"
  private_key_encoding  = "PKCS8" // must be PKCS8 for java compat
  private_key_algorithm = "RSA"
  common_name           = "${local.cluster_name}.${var.namespace}"
  service_names = concat(
    [
      local.cluster_name,
    ],
    [for i in range(var.replica_count) : "${local.cluster_name}-master-${i}.${local.cluster_name}-headless"]
  )
}

module "superuser_certs" {
  source                = "../kube_internal_cert"
  namespace             = var.namespace
  secret_name           = "${local.cluster_name}-superuser-certs"
  private_key_encoding  = "PKCS8" // must be PKCS8 for java compat
  private_key_algorithm = "RSA"
  common_name           = "superuser.${local.cluster_name}.${var.namespace}"
}

/***************************************
* Backup Bucket
***************************************/

resource "random_id" "bucket_name" {
  byte_length = 8
  prefix      = "${var.namespace}-${local.cluster_name}-storage-"
}

module "s3_bucket" {
  source = "../aws_s3_private_bucket"

  bucket_name                     = random_id.bucket_name.hex
  description                     = "Remote storage for the ${local.cluster_name} OpenSearch cluster."
  versioning_enabled              = false
  audit_log_enabled               = false
  intelligent_transitions_enabled = false
  force_destroy                   = var.backups_force_delete

  access_policy = var.s3_bucket_access_policy
}


data "aws_iam_policy_document" "s3_access" {
  statement {
    effect  = "Allow"
    actions = ["s3:*"]
    resources = [
      module.s3_bucket.bucket_arn,
      "${module.s3_bucket.bucket_arn}/*"
    ]
  }
}

data "aws_region" "region" {}

module "irsa" {
  source = "../kube_sa_auth_aws"

  service_account           = module.opensearch.service_account_name
  service_account_namespace = var.namespace
  iam_policy_json           = data.aws_iam_policy_document.s3_access.json
  ip_allow_list             = var.aws_iam_ip_allow_list
}


/***************************************
* OpenSearch Configs
***************************************/

resource "kubernetes_secret" "security_config" {
  metadata {
    name      = "${local.cluster_name}-security-config"
    namespace = var.namespace
    labels    = module.util.labels
  }
  data = {
    "config.yml"        = local.security_config
    "roles_mapping.yml" = local.role_mappings
    "roles.yml" = yamlencode({
      _meta = {
        type           = "roles"
        config_version = 2
      }
    })
    "internal_users.yml" = yamlencode({
      _meta = {
        type           = "internalusers"
        config_version = 2
      }
    })
    "action_groups.yml" = yamlencode({
      _meta = {
        type           = "actiongroups"
        config_version = 2
      }
    })
    "tenants.yml" = yamlencode({
      _meta = {
        type           = "tenants"
        config_version = 2
      }
    })
    "nodes_dn.yml" = yamlencode({
      _meta = {
        type           = "nodesdn"
        config_version = 2
      }
    })
    "whitelist.yml" = yamlencode({
      _meta = {
        type           = "whitelist"
        config_version = 2
      }
    })
  }
}

resource "kubernetes_config_map" "config" {
  metadata {
    name      = "${local.cluster_name}-config"
    namespace = var.namespace
    labels    = module.util.labels
  }
  data = {
    "opensearch.yml" = yamlencode({
      "cluster.name" = local.cluster_name
      "network.host" = "0.0.0.0"


      // See https://opster.com/guides/opensearch/opensearch-data-architecture/how-to-configure-opensearch-node-roles/
      "node.roles" = ["cluster_manager", "ingest", "data", "remote_cluster_client"]

      // Bootstrapping
      "discovery.seed_hosts"                  = ["${local.cluster_name}-headless"]
      "cluster.initial_cluster_manager_nodes" = [for i in range(var.replica_count) : "${local.cluster_name}-${i}"]
      "bootstrap.memory_lock"                 = true // prevents swapping


      // TLS setup
      "plugins.security.ssl.certificates_hot_reload.enabled"  = true
      "plugins.security.ssl.transport.pemkey_filepath"        = "./node-certs/tls.key"
      "plugins.security.ssl.transport.pemcert_filepath"       = "./node-certs/tls.crt"
      "plugins.security.ssl.transport.pemtrustedcas_filepath" = "./node-certs/ca.crt"
      "plugins.security.ssl.transport.enabled_protocols"      = ["TLSv1.3"]
      "plugins.security.ssl.http.enabled"                     = true
      "plugins.security.ssl.http.pemkey_filepath"             = "./node-certs/tls.key"
      "plugins.security.ssl.http.pemcert_filepath"            = "./node-certs/tls.crt"
      "plugins.security.ssl.http.pemtrustedcas_filepath"      = "./node-certs/ca.crt"
      "plugins.security.ssl.http.enabled_protocols"           = ["TLSv1.3"]


      // Enabble client cert auth
      "plugins.security.ssl.http.clientauth_mode" = "OPTIONAL"

      // Disable unsave settings
      "plugins.security.allow_unsafe_democertificates"     = false
      "plugins.security.system_indices.permission.enabled" = false // only admins can do this
      "plugins.security.allow_default_init_securityindex"  = false


      // Enable roles
      "plugins.security.restapi.roles_enabled" = [
        "all_access",
        "security_rest_api_access"
      ]


      // Remote state bucket config
      "node.attr.remote_store.repository.s3.type"            = "s3"
      "node.attr.remote_store.repository.s3.settings.bucket" = module.s3_bucket.bucket_name
      "node.attr.remote_store.repository.s3.settings.region" = data.aws_region.region.name
      "s3.client.default.identity_token_file"                = "/usr/share/opensearch/config/aws-web-identity-token-file" // This MUST be set for IRSA to be enabled
      "s3.client.default.region"                             = data.aws_region.region.name

      // Segment Replication
      // See https://opensearch.org/docs/latest/tuning-your-cluster/availability-and-recovery/segment-replication/index/
      "cluster.indices.replication.strategy"              = "SEGMENT"
      "cluster.routing.allocation.balance.prefer_primary" = true
      "segrep.pressure.enabled"                           = true

      // Broken due to https://github.com/opensearch-project/OpenSearch/issues/15902
      // TODO: Fix
      # "node.attr.remote_store.segment.repository" = "s3"
      # "node.attr.remote_store.translog.repository" = "s3"

      // Cluster state backups
      // See https://opensearch.org/docs/latest/tuning-your-cluster/availability-and-recovery/remote-store/remote-cluster-state/
      "node.attr.remote_store.state.repository"         = "s3"
      "node.attr.remote_store.routing_table.repository" = "s3"
      "cluster.remote_store.state.path.prefix"          = "state/"
      "cluster.remote_store.routing_table.path.prefix"  = "routing/"
      "cluster.remote_store.publication.enabled"        = true
      "cluster.remote_store.state.enabled"              = true

      // Security indices
      "plugins.security.system_indices.enabled" = true
      "plugins.security.system_indices.indices" = [
        ".opendistro-alerting-config",
        ".opendistro-alerting-alert*",
        ".opendistro-anomaly-results*",
        ".opendistro-anomaly-detector*",
        ".opendistro-anomaly-checkpoints",
        ".opendistro-anomaly-detection-state",
        ".opendistro-reports-*",
        ".opendistro-notifications-*",
        ".opendistro-notebooks",
        ".opendistro-asynchronous-search-response*"
      ]

      // Authorize node certs
      "plugins.security.nodes_dn" = [
        "CN=${local.cluster_name}.${var.namespace}"
      ]

      // Authorize admin certs
      "plugins.security.authcz.admin_dn" = [
        "CN=superuser.${local.cluster_name}.${var.namespace}"
      ]
    })
  }
}


/***************************************
* OpenSearch Deployment
***************************************/

module "opensearch" {
  source = "../kube_stateful_set"

  name      = local.cluster_name
  namespace = var.namespace

  replicas = var.replica_count

  controller_nodes_enabled             = var.controller_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required != null ? var.instance_type_anti_affinity_required : local.sla_target == 3
  host_anti_affinity_required          = local.sla_target >= 2
  az_spread_required                   = true
  az_spread_preferred                  = true
  lifetime_evictions_enabled           = false
  vpa_enabled                          = var.vpa_enabled
  priority_class_name                  = module.constants.workload_important_priority_class_name


  containers = [
    {
      name             = "opensearch"
      image_registry   = "docker.io"
      image_repository = "opensearchproject/opensearch"
      image_tag        = var.opensearch_version
      command = [
        "sh", "-c",
        file("${path.module}/entrypoint.sh")
      ]

      minimum_cpu    = 500
      minimum_memory = 1000

      read_only = false // TODO: Fix

      liveness_probe_type = "TCP"
      liveness_probe_port = 9200
      ports = {
        http = {
          port = 9200
        }
        transport = {
          port = 9300
        }
        metrics = {
          port = 9600
        }
      }
    }
  ]
  volume_mounts = {
    "data" = {
      storage_class   = var.storage_class
      initial_size_gb = var.storage_initial_gb
      size_limit_gb   = var.storage_limit_gb
      increase_gb     = var.storage_increase_gb
      mount_path      = "/usr/share/opensearch/data"
      backups_enabled = false
    }
  }

  config_map_mounts = {
    "${kubernetes_config_map.config.metadata[0].name}" = {
      sub_paths  = ["opensearch.yml"]
      mount_path = "/usr/share/opensearch/config"
    }
  }

  secret_mounts = {
    "${module.node_certs.secret_name}" = {
      mount_path = "/usr/share/opensearch/config/node-certs"
    }
    "${module.superuser_certs.secret_name}" = {
      mount_path = "/usr/share/opensearch/config/superuser-certs"
    }
  }

  common_env = {
    OPENSEARCH_JAVA_OPTS        = "-Xmx512M -Xms512M" // TODO: Dynamic JVM memory sizing
    OPENSEARCH_PATH_CONF        = "/usr/share/opensearch/config"
    DISABLE_INSTALL_DEMO_CONFIG = "true" // Needed if using the default entrypoint
  }

  termination_grace_period_seconds = 120
  volume_retention_policy = {
    when_scaled  = "Delete"
    when_deleted = "Delete"
  }

  depends_on = [module.node_certs, module.superuser_certs]
}

// This is required to enable RBAC in the cluster. For whatever reason, the opensearch team has decided that this
// isn't something that can be defined in the core configuration and rather needs to be deployed
// only after the initial cluster is up and running.
module "security_update_job" {
  source = "../kube_job"

  name      = "${local.cluster_name}-security-update"
  namespace = var.namespace

  spot_nodes_enabled        = var.spot_nodes_enabled
  arm_nodes_enabled         = var.arm_nodes_enabled
  burstable_nodes_enabled   = var.burstable_nodes_enabled
  controller_nodes_enabled  = var.controller_nodes_enabled
  node_image_cached_enabled = false

  containers = [
    {
      name             = "update"
      image_registry   = "docker.io"
      image_repository = "opensearchproject/opensearch"
      image_tag        = var.opensearch_version
      command = [
        "/usr/share/opensearch/plugins/opensearch-security/tools/securityadmin.sh",
        "-cert", "/usr/share/opensearch/config/superuser-certs/tls.crt",
        "-key", "/usr/share/opensearch/config/superuser-certs/tls.key",
        "-cacert", "/usr/share/opensearch/config/superuser-certs/ca.crt",
        "-h", "${local.cluster_name}.${var.namespace}",
        "-cd", "/usr/share/opensearch/config/opensearch-security"
      ]
      env = {
        CONFIG_HASH = local.security_hash
      }
    }
  ]

  secret_mounts = {
    "${module.superuser_certs.secret_name}" = {
      mount_path = "/usr/share/opensearch/config/superuser-certs"
    }
    "${local.cluster_name}-security-config" = {
      mount_path = "/usr/share/opensearch/config/opensearch-security"
    }
  }

  depends_on = [module.opensearch]
}

/***************************************
* Vault Authentication
***************************************/

# resource "vault_database_secret_backend_role" "reader" {
#   backend             = "db"
#   name                = "reader-${var.namespace}-${local.cluster_name}"
#   db_name             = vault_database_secret_backend_connection.redis.name
#   creation_statements = [jsonencode(["%R~*", "&*", "+@all", "-@write", "-@admin", "-@dangerous"])]
#   default_ttl         = 60 * 60 * var.vault_credential_lifetime_hours
#   max_ttl             = 60 * 60 * var.vault_credential_lifetime_hours
# }

# resource "vault_database_secret_backend_role" "admin" {
#   backend             = "db"
#   name                = "admin-${var.namespace}-${local.cluster_name}"
#   db_name             = vault_database_secret_backend_connection.redis.name
#   creation_statements = [jsonencode(["%RW~*", "&*", "+@all", "-@admin", "-@dangerous"])]
#   default_ttl         = 60 * 60 * var.vault_credential_lifetime_hours
#   max_ttl             = 60 * 60 * var.vault_credential_lifetime_hours
# }

# resource "vault_database_secret_backend_role" "superuser" {
#   backend             = "db"
#   name                = "superuser-${var.namespace}-${local.cluster_name}"
#   db_name             = vault_database_secret_backend_connection.redis.name
#   creation_statements = [jsonencode(["~*", "&*", "+@all", "-acl|deluser", "-acl|genpass", "-acl|log", "-acl|setuser"])]
#   default_ttl         = 60 * 60 * var.vault_credential_lifetime_hours
#   max_ttl             = 60 * 60 * var.vault_credential_lifetime_hours
# }

# resource "vault_database_secret_backend_connection" "redis" {
#   backend     = "db"
#   name        = "${var.namespace}-${local.cluster_name}"
#   plugin_name = "redis-database-plugin"

#   allowed_roles = [
#     "reader-${var.namespace}-${local.cluster_name}",
#     "admin-${var.namespace}-${local.cluster_name}",
#     "superuser-${var.namespace}-${local.cluster_name}",
#   ]

#   redis {
#     host     = "${local.cluster_name}-master.${var.namespace}"
#     port     = 6379
#     tls      = false
#     password = random_password.root_password.result
#     username = "default" // This is the main superuser
#   }

#   verify_connection = true

#   depends_on = [helm_release.redis]
# }


/***************************************
* Vault Secrets
***************************************/

# data "vault_policy_document" "vault_secrets" {
#   rule {
#     path         = "db/creds/${vault_database_secret_backend_role.reader.name}"
#     capabilities = ["read", "list"]
#     description  = "Allows getting read-only database credentials"
#   }
#   rule {
#     path         = "db/creds/${vault_database_secret_backend_role.admin.name}"
#     capabilities = ["read", "list"]
#     description  = "Allows getting admin database credentials"
#   }
#   rule {
#     path         = "db/creds/${vault_database_secret_backend_role.superuser.name}"
#     capabilities = ["read", "list"]
#     description  = "Allows getting superuser database credentials"
#   }
# }

# module "vault_auth_vault_secrets" {
#   source                    = "../kube_sa_auth_vault"
#   service_account           = local.cluster_name
#   service_account_namespace = var.namespace
#   vault_policy_hcl          = data.vault_policy_document.vault_secrets.hcl
#   audience                  = "vault"
# }

# resource "kubectl_manifest" "vault_connection" {
#   yaml_body = yamlencode({
#     apiVersion = "secrets.hashicorp.com/v1beta1"
#     kind       = "VaultConnection"
#     metadata = {
#       name      = local.cluster_name
#       namespace = var.namespace
#       labels    = module.util.labels
#     }
#     spec = {
#       address = "http://vault-active.vault.svc.cluster.local:8200"
#     }
#   })
#   force_conflicts   = true
#   server_side_apply = true
# }

# resource "kubectl_manifest" "vault_auth" {
#   yaml_body = yamlencode({
#     apiVersion = "secrets.hashicorp.com/v1beta1"
#     kind       = "VaultAuth"
#     metadata = {
#       name      = local.cluster_name
#       namespace = var.namespace
#       labels    = module.util.labels
#     }
#     spec = {
#       vaultConnectionRef = local.cluster_name
#       method             = "kubernetes"
#       mount              = "kubernetes"
#       allowedNamespaces  = [var.namespace]
#       kubernetes = {
#         role           = module.vault_auth_vault_secrets.role_name
#         serviceAccount = local.cluster_name
#         audiences      = ["vault"]
#       }
#     }
#   })
#   force_conflicts   = true
#   server_side_apply = true
#   depends_on        = [kubectl_manifest.vault_connection]
# }

# resource "kubectl_manifest" "vault_secrets" {
#   for_each = {
#     admin     = "creds/${vault_database_secret_backend_role.admin.name}"
#     reader    = "creds/${vault_database_secret_backend_role.reader.name}"
#     superuser = "creds/${vault_database_secret_backend_role.superuser.name}"
#   }
#   yaml_body = yamlencode({
#     apiVersion = "secrets.hashicorp.com/v1beta1"
#     kind       = "VaultDynamicSecret"
#     metadata = {
#       name      = "${local.cluster_name}-${each.key}-creds"
#       namespace = var.namespace
#       labels    = module.util.labels
#     }
#     spec = {
#       vaultAuthRef   = local.cluster_name
#       mount          = "db"
#       path           = each.value
#       renewalPercent = 50
#       destination = {
#         create = true
#         name   = "${local.cluster_name}-${each.key}-creds"
#       }
#     }
#   })
#   force_conflicts   = true
#   server_side_apply = true
#   depends_on        = [kubectl_manifest.vault_auth]
# }

/***************************************
* Disruption Windows
***************************************/

# module "disruption_window_controller" {
#   count  = var.voluntary_disruption_window_enabled ? 1 : 0
#   source = "../kube_disruption_window_controller"

#   namespace                   = var.namespace
#   vpa_enabled                 = var.vpa_enabled
#   panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
#   pull_through_cache_enabled  = var.pull_through_cache_enabled

#   cron_schedule = var.voluntary_disruption_window_cron_schedule
# }

/***************************************
* Image Cache
***************************************/

# module "image_cache" {
#   count  = var.node_image_cached_enabled ? 1 : 0
#   source = "../kube_node_image_cache"

#   images = [
#     {
#       registry          = "docker.io"
#       repository        = "bitnami/redis"
#       tag               = "7.4.1-debian-12-r2"
#       arm_nodes_enabled = var.arm_nodes_enabled
#     },
#     {
#       registry          = "docker.io"
#       repository        = "bitnami/redis-sentinel"
#       tag               = "7.4.1-debian-12-r2"
#       arm_nodes_enabled = var.arm_nodes_enabled
#     },
#     {
#       registry          = "docker.io"
#       repository        = "bitnami/redis-exporter"
#       tag               = "1.66.0-debian-12-r2"
#       arm_nodes_enabled = var.arm_nodes_enabled
#     },
#     {
#       registry          = "docker.io"
#       repository        = "bitnami/kubectl"
#       tag               = "1.31.2-debian-12-r6"
#       arm_nodes_enabled = var.arm_nodes_enabled
#     }
#   ]
# }