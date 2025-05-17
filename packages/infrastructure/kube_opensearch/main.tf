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
          basic_internal_auth_domain = {
            http_enabled      = true
            transport_enabled = true
            order             = 1
            http_authenticator = {
              type      = "basic"
              challenge = "true"
            }
            authentication_backend = {
              type = "internal"
            }
          }
          clientcert_auth_domain = {
            http_enabled      = true
            transport_enabled = true
            order             = 2
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
      users    = ["superuser.${local.cluster_name}.${var.namespace}", "superuser"]
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

  opensearch_yml = yamlencode(merge({
    "cluster.name" = local.cluster_name
    "network.host" = "0.0.0.0"


    // See https://opster.com/guides/opensearch/opensearch-data-architecture/how-to-configure-opensearch-node-roles/
    // and https://docs.opensearch.org/docs/latest/tuning-your-cluster/
    // TODO: In the future, we should provide extra configuration knobs
    // to allow several different node groups in the cluster, each with specific
    // roles.
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


    // Enable client cert auth
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

    // For compatibility with tf's bcrypt algorithm
    "plugins.security.password.hashing.bcrypt.minor"  = "A"
    "plugins.security.password.hashing.bcrypt.rounds" = 10

    // Remote state bucket config
    "node.attr.remote_store.repository.s3.type"            = "s3"
    "node.attr.remote_store.repository.s3.settings.bucket" = module.s3_bucket.bucket_name
    "node.attr.remote_store.repository.s3.settings.region" = data.aws_region.region.name
    //"s3.client.default.identity_token_file"                = "/usr/share/opensearch/config/aws-web-identity-token-file" // This MUST be set for IRSA to be enabled
    "s3.client.default.region"   = data.aws_region.region.name
    "s3.client.default.endpoint" = "s3.${data.aws_region.region.name}.amazonaws.com"

    // Segment Replication
    // See https://opensearch.org/docs/latest/tuning-your-cluster/availability-and-recovery/segment-replication/index/
    "cluster.indices.replication.strategy"              = "SEGMENT"
    "cluster.routing.allocation.balance.prefer_primary" = true
    "segrep.pressure.enabled"                           = true
    "node.attr.remote_store.segment.repository"         = "s3"
    "node.attr.remote_store.translog.repository"        = "s3"

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

    // Shard management
    "cluster.allocator.existing_shards_allocator.batch_enabled" = true            // Improved allocator algorithm which improves recovery times (technically experimental, but should be safe)
    "cluster.routing.allocation.shard_movement_strategy"        = "PRIMARY_FIRST" // Should help prevent a red cluster status if shard movement fails
    "indices.recovery.max_bytes_per_sec"                        = "0mb"           // Disable recovery rate limiting

    // Disk management
    "cluster.routing.allocation.disk.watermark.high" = "${min(100 - (var.storage_increase_threshold_percent - 10), 90)}%"

    // Logging adjustments
    "logger._root"                                                                             = var.log_level
    "logger.org.opensearch.alerting.util.destinationmigration.DestinationMigrationCoordinator" = "WARN" // See https://github.com/opensearch-project/alerting/issues/1183

    // Slow logs
    "cluster.search.request.slowlog.threshold.trace" = var.slow_request_log_thresholds.trace
    "cluster.search.request.slowlog.threshold.debug" = var.slow_request_log_thresholds.debug
    "cluster.search.request.slowlog.threshold.warn"  = var.slow_request_log_thresholds.warn
    "cluster.search.request.slowlog.threshold.info"  = var.slow_request_log_thresholds.info
    "cluster.search.request.slowlog.level"           = var.log_level
  }, var.extra_cluster_settings))

  security_hash = md5("${local.role_mappings}${local.security_config}")

  cluster_name    = random_id.id.hex
  dashboards_name = random_id.dashboards_id.hex
}

resource "random_id" "id" {
  byte_length = 2
  prefix      = "opensearch-"
}

resource "random_id" "dashboards_id" {
  byte_length = 2
  prefix      = "opensearch-dashboards-"
}

data "pf_kube_labels" "labels" {
  module = "kube_opensearch"
}

data "pf_metadata" "metadata" {}


module "constants" {
  source = "../kube_constants"
}

/***************************************
* Certificate Issuer - Used for authentication
***************************************/

resource "vault_mount" "opensearch" {
  path                      = "pki/db/${var.namespace}-${local.cluster_name}"
  type                      = "pki"
  description               = "Root CA for the ${local.cluster_name} opensearchcluster"
  default_lease_ttl_seconds = 60 * 60 * 24
  max_lease_ttl_seconds     = 60 * 60 * 24 * 365 * 10
}

resource "vault_pki_secret_backend_root_cert" "opensearch" {
  backend              = vault_mount.opensearch.path
  type                 = "internal"
  common_name          = var.vault_internal_url
  ttl                  = 60 * 60 * 24 * 365 * 10
  format               = "pem"
  private_key_format   = "der"
  key_type             = "ec"
  key_bits             = 256
  exclude_cn_from_sans = true
  ou                   = "engineering"
  organization         = "panfactum"
}

resource "vault_pki_secret_backend_config_urls" "opensearch" {
  backend = vault_mount.opensearch.path
  issuing_certificates = [
    "${var.vault_internal_url}/v1/pki/ca"
  ]
  crl_distribution_points = [
    "${var.vault_internal_url}/v1/pki/crl"
  ]
}

resource "kubernetes_service_account" "vault_issuer" {
  metadata {
    name      = "${var.namespace}-${local.cluster_name}-issuer"
    namespace = "cert-manager"
    labels    = data.pf_kube_labels.labels.labels
  }
}

resource "kubernetes_role" "vault_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_issuer.metadata[0].name
    namespace = "cert-manager"
    labels    = data.pf_kube_labels.labels.labels
  }
  rule {
    verbs          = ["create"]
    resources      = ["serviceaccounts/token"]
    resource_names = [kubernetes_service_account.vault_issuer.metadata[0].name]
    api_groups     = [""]
  }
}

resource "kubernetes_role_binding" "vault_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_issuer.metadata[0].name
    namespace = "cert-manager"
    labels    = data.pf_kube_labels.labels.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = "cert-manager"
    namespace = "cert-manager"
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.vault_issuer.metadata[0].name
  }
}

data "vault_policy_document" "vault_issuer" {
  rule {
    capabilities = ["create", "read", "update"]
    path         = "${vault_mount.opensearch.path}/sign/${vault_pki_secret_backend_role.vault_issuer.name}"
  }
}

module "vault_role" {
  source = "../kube_sa_auth_vault"

  service_account           = kubernetes_service_account.vault_issuer.metadata[0].name
  service_account_namespace = "cert-manager"
  vault_policy_hcl          = data.vault_policy_document.vault_issuer.hcl
  audience                  = "vault://db-${var.namespace}-${local.cluster_name}"
  token_ttl_seconds         = 120
}

resource "vault_pki_secret_backend_role" "vault_issuer" {
  backend                     = vault_mount.opensearch.path
  name                        = kubernetes_service_account.vault_issuer.metadata[0].name
  allow_any_name              = true
  allow_wildcard_certificates = true
  enforce_hostnames           = false
  allow_ip_sans               = true
  require_cn                  = false

  key_type = "rsa"
  key_bits = 4096

  max_ttl = 60 * 60 * 24 * 14 // Certs need to be rotated at least every 2 weeks (TODO: Make configurable)
}

resource "kubectl_manifest" "cluster_issuer" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name   = "db-${var.namespace}-${local.cluster_name}"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      vault = {
        path   = "${vault_mount.opensearch.path}/sign/${vault_pki_secret_backend_role.vault_issuer.name}"
        server = var.vault_internal_url
        auth = {
          kubernetes = {
            role      = module.vault_role.role_name
            mountPath = "/v1/auth/kubernetes"
            serviceAccountRef = {
              name = kubernetes_service_account.vault_issuer.metadata[0].name
            }
          }
        }
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
}


/***************************************
* Node Certs
***************************************/

module "node_certs" {
  source                = "../kube_internal_cert"
  namespace             = var.namespace
  secret_name           = "${local.cluster_name}-node-certs"
  private_key_encoding  = "PKCS8" // must be PKCS8 for java compat
  private_key_algorithm = "RSA"
  common_name           = "${local.cluster_name}.${var.namespace}"
  issuer_name           = "db-${var.namespace}-${local.cluster_name}"
  service_names = concat(
    [
      local.cluster_name,
    ],
    [for i in range(var.replica_count) : "${local.cluster_name}-master-${i}.${local.cluster_name}-headless"]
  )

  depends_on = [kubectl_manifest.cluster_issuer]
}


/***************************************
* Client Certs
***************************************/

module "client_certs" {
  for_each = toset(["superuser", "admin", "reader"])

  source                = "../kube_internal_cert"
  namespace             = var.namespace
  secret_name           = "${local.cluster_name}-${each.key}-certs"
  private_key_encoding  = "PKCS8" // must be PKCS8 for java compat
  private_key_algorithm = "RSA"
  common_name           = "${each.key}.${local.cluster_name}.${var.namespace}"
  issuer_name           = "db-${var.namespace}-${local.cluster_name}"

  depends_on = [kubectl_manifest.cluster_issuer]
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

# We don't use IRSA b/c of https://github.com/opensearch-project/OpenSearch/issues/16523
module "aws_creds" {
  source                    = "../kube_aws_creds"
  namespace                 = var.namespace
  iam_policy_json           = data.aws_iam_policy_document.s3_access.json
  credential_lifetime_hours = 24 * 14
}

/***************************************
* OpenSearch Configs
***************************************/
resource "random_id" "encryption_key" {
  byte_length = 16 # 16 bytes = 32 hex characters
  prefix      = ""
}

resource "kubernetes_secret" "security_config" {
  metadata {
    name      = "${local.cluster_name}-security-config"
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
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

      superuser = {
        hash          = bcrypt(random_password.dashboard_superuser.result) #"$2y$12$bMHd6ImdI91C3qT3dH8GLezdFmet6MbBOEyHyobA83bI5K1LxJiTe" "$2y$12$IEe4BHM4WoEX/W2MX8YQOeNkEwWTwSkQ9fvcGIT81Ft9KyV2K9VO."
        reserved      = false
        backend_roles = ["kibana_user"]
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
    labels    = data.pf_kube_labels.labels.labels
  }
  data = {
    "opensearch.yml" = local.opensearch_yml
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
  host_anti_affinity_required          = true
  az_spread_required                   = true
  az_spread_preferred                  = true
  lifetime_evictions_enabled           = false
  vpa_enabled                          = var.vpa_enabled
  priority_class_name                  = module.constants.workload_important_priority_class_name

  voluntary_disruptions_enabled             = var.voluntary_disruptions_enabled
  voluntary_disruption_window_enabled       = var.voluntary_disruption_window_enabled
  voluntary_disruption_window_cron_schedule = var.voluntary_disruption_window_cron_schedule
  voluntary_disruption_window_seconds       = var.voluntary_disruption_window_seconds

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
      minimum_memory = var.minimum_memory_mb

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
      storage_class              = var.storage_class
      initial_size_gb            = var.storage_initial_gb
      size_limit_gb              = var.storage_limit_gb
      increase_gb                = var.storage_increase_gb
      increase_threshold_percent = var.storage_increase_threshold_percent
      mount_path                 = "/usr/share/opensearch/data"
      backups_enabled            = false
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
    "${module.client_certs.superuser.secret_name}" = {
      mount_path = "/usr/share/opensearch/config/superuser-certs"
    }
  }

  common_env = {
    OPENSEARCH_PATH_CONF        = "/usr/share/opensearch/config"
    DISABLE_INSTALL_DEMO_CONFIG = "true" // Needed if using the default entrypoint
  }

  common_secrets = {
    OPENSEARCH_MASTER_KEY = random_id.encryption_key.hex
  }

  common_env_from_secrets = {
    AWS_ACCESS_KEY_ID = {
      secret_name = module.aws_creds.creds_secret
      key         = "AWS_ACCESS_KEY_ID"
    }
    AWS_SECRET_ACCESS_KEY = {
      secret_name = module.aws_creds.creds_secret
      key         = "AWS_SECRET_ACCESS_KEY"
    }
  }

  termination_grace_period_seconds = 120
  volume_retention_policy = {
    when_scaled  = "Delete"
    when_deleted = "Delete"
  }

  depends_on = [
    module.node_certs,
    module.client_certs
  ]
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
    "${module.client_certs.superuser.secret_name}" = {
      mount_path = "/usr/share/opensearch/config/superuser-certs"
    }
    "${local.cluster_name}-security-config" = {
      mount_path = "/usr/share/opensearch/config/opensearch-security"
    }
  }

  depends_on = [module.opensearch]
}

/***************************************
* OpenSearch Dashboards
***************************************/

resource "random_password" "dashboard_superuser" {
  length = 32
}

resource "kubernetes_secret" "dashboard_superuser" {
  metadata {
    name      = "${local.dashboards_name}-creds"
    namespace = var.namespace
    labels    = module.dashboards_util.labels
  }

  data = {
    OPENSEARCH_USERNAME = "superuser"
    OPENSEARCH_PASSWORD = random_password.dashboard_superuser.result
  }
}

module "dashboards_util" {
  source = "../kube_workload_utility"

  workload_name                        = local.dashboards_name
  controller_nodes_enabled             = var.controller_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required != null ? var.instance_type_anti_affinity_required : local.sla_target == 3
  host_anti_affinity_required          = true
  az_spread_required                   = local.sla_target >= 2
  lifetime_evictions_enabled           = false
  extra_labels                         = data.pf_kube_labels.labels.labels
}

resource "helm_release" "opensearch_dashboards" {
  count           = var.dashboard_enabled ? 1 : 0
  namespace       = var.namespace
  name            = random_id.id.hex
  repository      = "https://opensearch-project.github.io/helm-charts"
  chart           = "opensearch-dashboards"
  version         = var.opensearch_version
  atomic          = var.wait
  cleanup_on_fail = var.wait
  wait            = var.wait
  recreate_pods   = false
  wait_for_jobs   = true
  timeout         = 60 * 15
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = local.dashboards_name
      replicaCount     = 2

      opensearchHosts = "https://${local.cluster_name}.${var.namespace}.svc.cluster.local:9200"
      config = {
        "opensearch_dashboards.yml" = yamlencode({

          "server.host" = "0.0.0.0"

          "opensearch_security.auth.type"                  = ["basicauth"]
          "opensearch_security.auth.multiple_auth_enabled" = false

          "opensearch.ssl.certificate"            = "/usr/share/opensearch/config/superuser-certs/tls.crt",
          "opensearch.ssl.key"                    = "/usr/share/opensearch/config/superuser-certs/tls.key",
          "opensearch.ssl.certificateAuthorities" = ["/usr/share/opensearch/config/superuser-certs/ca.crt"],
          "opensearch.ssl.verificationMode"       = "full"
        })
      }

      resources = {
        requests = {
          cpu    = "100m"
          memory = "200M"
        }
        limits = {
          cpu    = "1000m"
          memory = "260M"
        }
      }

      envFrom = [
        {
          secretRef = {
            name = kubernetes_secret.dashboard_superuser.metadata[0].name
          }
        }
      ]

      updateStrategy = {
        type = "RollingUpdate"
        rollingUpdate = {
          maxSurge       = 0
          maxUnavailable = 1
        }
      }

      extraVolumeMounts = [
        {
          mountPath = "/usr/share/opensearch/config/superuser-certs"
          readOnly  = true
          name      = "superuser-certs"
        }
      ]

      extraVolumes = [
        {
          name = "superuser-certs"
          secret = {
            defaultMode = 511
            optional    = false
            secretName  = module.client_certs.superuser.secret_name
          }
        }
      ]

      affinity                  = module.dashboards_util.affinity
      topologySpreadConstraints = module.dashboards_util.topology_spread_constraints
      tolerations               = module.dashboards_util.tolerations

      labels = module.dashboards_util.labels
    })
  ]
  depends_on = [module.opensearch]

  lifecycle {
    precondition {
      condition     = !var.dashboard_enabled || var.dashboard_domain != null
      error_message = "If dashboard_enabled is true, then dashboard_domain must be set."
    }
  }
}

resource "kubectl_manifest" "pdb" {
  count = var.dashboard_enabled ? 1 : 0

  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = local.dashboards_name
      namespace = var.namespace
      labels    = module.dashboards_util.labels,
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.dashboards_util.match_labels
      }
      maxUnavailable = 1
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.opensearch_dashboards[0]]
}

resource "kubectl_manifest" "vpa" {
  count = var.dashboard_enabled && var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = local.dashboards_name
      namespace = var.namespace
      labels    = module.dashboards_util.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = local.dashboards_name
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.opensearch_dashboards[0]]
}


module "ingress" {
  count = var.dashboard_enabled ? 1 : 0

  source = "../kube_ingress"

  namespace = var.namespace
  name      = local.dashboards_name
  domains   = [var.dashboard_domain]
  ingress_configs = [
    {
      service      = local.dashboards_name
      service_port = 5601
    }
  ]
  cdn_mode_enabled               = false
  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = false
  cross_origin_opener_policy     = "same-origin-allow-popups" // Required for SSO logins
  permissions_policy_enabled     = true
  csp_enabled                    = false
  cors_enabled                   = false

  depends_on = [helm_release.opensearch_dashboards[0]]
}
