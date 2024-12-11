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
      version = "0.0.4"
    }
  }
}

locals {
  customization_hash = md5(join("", [
    for filename in sort(fileset(path.module, "kustomize/*")) : filesha256("${path.module}/${filename}")
  ]))
}

resource "random_id" "id" {
  byte_length = 2
  prefix      = "redis-"
}

data "pf_kube_labels" "labels" {
  module = "kube_redis"
}

module "util" {
  source = "../kube_workload_utility"

  workload_name                        = random_id.id.hex
  controller_nodes_enabled             = var.controller_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required
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
// Currently, if we do rotate this via terraform,
// the cluster will crash as the password is not updated
// for all nodes simultaneously
// Potentially need to deploy a job
// that runs redis> CONFIG SET requirepass <your new password>
// on each node
// The same will likely apply to certs: https://github.com/redis/redis/issues/8756
resource "random_password" "root_password" {
  length  = 64
  special = false
}

moved {
  from = random_password.superuser_password
  to   = random_password.root_password
}

resource "kubernetes_secret" "root_creds" {
  type = "kubernetes.io/basic-auth"
  metadata {
    name      = nonsensitive("redis-superuser-${sha256(random_password.root_password.result)}")
    namespace = var.namespace
    labels    = module.util.labels
  }
  data = {
    password = random_password.root_password.result
  }
}

moved {
  from = kubernetes_secret.superuser
  to   = kubernetes_secret.root_creds
}

/***************************************
* Redis
***************************************/

resource "helm_release" "redis" {
  namespace       = var.namespace
  name            = random_id.id.hex
  repository      = "oci://registry-1.docker.io/bitnamicharts"
  chart           = "redis"
  version         = var.helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  timeout         = 60 * 15
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = random_id.id.hex
      commonLabels     = module.util.labels

      commonAnnotations = {
        "panfactum.com/db"             = "true"
        "panfactum.com/db-type"        = "Redis"
        "panfactum.com/reader-role"    = "reader-${var.namespace}-${random_id.id.hex}"
        "panfactum.com/admin-role"     = "admin-${var.namespace}-${random_id.id.hex}"
        "panfactum.com/superuser-role" = "superuser-${var.namespace}-${random_id.id.hex}"
        "panfactum.com/vault-mount"    = "db/${var.namespace}-${random_id.id.hex}"
        "panfactum.com/service"        = "${random_id.id.hex}-master.${var.namespace}"
        "panfactum.com/service-port"   = "6379"
        "customization-hash"           = local.customization_hash
      }

      global = {
        storageClass = "ebs-standard"
      }

      kubectl = {
        requests = {
          memory = "20Mi"
        }
        limits = {
          memory = "30Mi"
        }
      }

      auth = {
        enabled                   = true
        sentinel                  = true
        existingSecret            = kubernetes_secret.root_creds.metadata[0].name
        existingSecretPasswordKey = "password"
      }

      networkPolicy = {
        enabled = false
      }

      tls = {
        enabled = false // We rely on the service mesh for TLS
      }

      // Needed to communicate with the kube api for setting failover labels
      rbac = {
        create = true
      }
      serviceAccount = {
        automountServiceAccountToken = true
      }

      // In sentinel mode, only the replica block is used
      replica = {
        replicaCount = var.replica_count

        automountServiceAccountToken = true

        extraFlags = concat(
          var.lfu_cache_enabled ? [
            "--maxmemory", "$MEMORY_REQUEST",
            "--maxmemory-policy", "allkeys-lfu",
            "--activedefrag", "yes"
          ] : [],
          [
            // This ensures that client buffers don't crash redis when payloads are very large and
            // fill the buffers
            "--maxmemory-clients", "$(( MEMORY_REQUEST * 15 / 100))",

            // Disable AOF saving
            "--appendonly", "no",

            // Snapshot settings
            "--save", var.redis_save
          ],
          var.redis_flags
        )

        extraEnvVars = [
          {
            name = "MEMORY_REQUEST"
            valueFrom = {
              resourceFieldRef = {
                containerName = "redis"
                resource      = "requests.memory"
              }
            }
          }
        ]

        podLabels = module.util.labels
        podAnnotations = {
          "config.linkerd.io/opaque-ports" = "6379,26379"
        }

        // For whatever reason the kubelet has trouble
        // running the readiness probe within the configured time
        // Fortunately, we do not really need readiness probes at all
        readinessProbe = {
          enabled = false
        }

        priorityClassName         = module.constants.workload_important_priority_class_name
        affinity                  = module.util.affinity
        tolerations               = module.util.tolerations
        topologySpreadConstraints = module.util.topology_spread_constraints
        schedulerName             = module.util.scheduler_name

        // Recommended by the helm chart docs
        podSecurityContext = {
          sysctls = [
            {
              name  = "net.core.somaxconn"
              value = "10000"
            }
          ]
        }

        persistence = {
          enabled = true
          size    = "${var.persistence_size_gb}Gi"
          persistentVolumeClaimRetentionPolicy = {
            enabled     = true
            whenScaled  = "Delete"
            whenDeleted = "Delete"
          }
          labels = {
            "panfactum.com/pvc-group" = "${var.namespace}.${random_id.id.hex}"
          }
          annotations = {
            "resize.topolvm.io/initial-resize-group-by" = "panfactum.com/pvc-group"
          }
        }
        resources = {
          requests = {
            memory = "${var.minimum_memory_mb}Mi"
          }
          limits = {
            memory = "${ceil(var.minimum_memory_mb * 1.3)}Mi"
          }
        }
      }

      sentinel = {
        enabled                 = true
        automateClusterRecovery = true
        downAfterMilliseconds   = 2000
        failoverTimeout         = 1000 * 60 * 3


        service = {
          // This will create a "master" service that will always
          // point to the current master so that we can support
          // clients that do not support sentinel
          createMaster = true
        }

        persistentVolumeClaimRetentionPolicy = {
          enabled     = true
          whenScaled  = "Delete"
          whenDeleted = "Delete"
        }

        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }
      }

      kubectl = {
        requests = {
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
        }
      }

      metrics = {
        enabled = var.monitoring_enabled
        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }
        serviceMonitor = {
          enabled   = var.monitoring_enabled
          interval  = "60s"
          namespace = var.namespace
        }
        prometheusRule = {
          enabled = var.monitoring_enabled
        }
      }
    })
  ]

  # Required due to this issue: https://github.com/bitnami/charts/issues/27479
  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
    args = [
      "${random_id.id.hex}-node",
      "${var.namespace}.${random_id.id.hex}"
    ]
  }
}

# This PDB allows one pod in the Redis cluster to be disrupted at a time
# unless voluntary_disruptions_enabled is set to false
resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = random_id.id.hex
      namespace = var.namespace
      labels    = module.util.labels,
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util.match_labels
      }
      maxUnavailable = var.voluntary_disruptions_enabled ? 1 : 0
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.redis]
}

# This PDB optionally limits disruptions on the master pod
# iff voluntary_disruption_window_enabled is set to true
resource "kubectl_manifest" "pdb_master" {
  count = var.voluntary_disruption_window_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${random_id.id.hex}-master"
      namespace = var.namespace
      labels = merge(
        module.util.labels,
        {
          "panfactum.com/voluntary-disruption-window-id" = var.voluntary_disruption_window_enabled ? module.disruption_window_controller[0].disruption_window_id : "false"
        }
      )
      annotations = {
        "panfactum.com/voluntary-disruption-window-max-unavailable" = "1"
        "panfactum.com/voluntary-disruption-window-seconds"         = tostring(var.voluntary_disruption_window_seconds)
      }
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = merge(
          module.util.match_labels,
          {
            isMaster = "true"
          }
        )
      }
      maxUnavailable = 0
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.redis]
  ignore_fields = concat(
    [
      "metadata.annotations.panfactum.com/voluntary-disruption-window-start"
    ],
    var.voluntary_disruption_window_enabled ? [
      "spec.maxUnavailable"
    ] : []
  )
}

resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = random_id.id.hex
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "${random_id.id.hex}-node"
      }
      resourcePolicy = {
        containerPolicies = [{
          containerName = "redis"
          minAllowed = {
            memory = "${var.minimum_memory_mb}Mi"
          }
        }]
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.redis]
}

module "pvc_annotator" {
  source = "../kube_pvc_annotator"

  namespace = var.namespace
  config = {
    "${var.namespace}.${random_id.id.hex}" = {
      annotations = {
        "velero.io/exclude-from-backups"  = tostring(!var.persistence_backups_enabled)
        "resize.topolvm.io/storage_limit" = "${var.persistence_storage_limit_gb != null ? var.persistence_storage_limit_gb : var.persistence_size_gb * 10}Gi"
        "resize.topolvm.io/increase"      = "${var.persistence_storage_increase_gb}Gi"
        "resize.topolvm.io/threshold"     = "${var.persistence_storage_increase_threshold_percent}%"
      }
      labels = module.util.labels
    }
  }
}

/***************************************
* Vault Authentication
***************************************/

resource "vault_database_secret_backend_role" "reader" {
  backend             = "db"
  name                = "reader-${var.namespace}-${random_id.id.hex}"
  db_name             = vault_database_secret_backend_connection.redis.name
  creation_statements = [jsonencode(["%R~*", "&*", "+@all", "-@write", "-@admin", "-@dangerous"])]
  default_ttl         = 60 * 60 * var.vault_credential_lifetime_hours
  max_ttl             = 60 * 60 * var.vault_credential_lifetime_hours
}

resource "vault_database_secret_backend_role" "admin" {
  backend             = "db"
  name                = "admin-${var.namespace}-${random_id.id.hex}"
  db_name             = vault_database_secret_backend_connection.redis.name
  creation_statements = [jsonencode(["%RW~*", "&*", "+@all", "-@admin", "-@dangerous"])]
  default_ttl         = 60 * 60 * var.vault_credential_lifetime_hours
  max_ttl             = 60 * 60 * var.vault_credential_lifetime_hours
}

resource "vault_database_secret_backend_role" "superuser" {
  backend             = "db"
  name                = "superuser-${var.namespace}-${random_id.id.hex}"
  db_name             = vault_database_secret_backend_connection.redis.name
  creation_statements = [jsonencode(["~*", "&*", "+@all", "-acl|deluser", "-acl|genpass", "-acl|log", "-acl|setuser"])]
  default_ttl         = 60 * 60 * var.vault_credential_lifetime_hours
  max_ttl             = 60 * 60 * var.vault_credential_lifetime_hours
}

resource "vault_database_secret_backend_connection" "redis" {
  backend     = "db"
  name        = "${var.namespace}-${random_id.id.hex}"
  plugin_name = "redis-database-plugin"

  allowed_roles = [
    "reader-${var.namespace}-${random_id.id.hex}",
    "admin-${var.namespace}-${random_id.id.hex}",
    "superuser-${var.namespace}-${random_id.id.hex}",
  ]

  redis {
    host     = "${random_id.id.hex}-master.${var.namespace}"
    port     = 6379
    tls      = false
    password = random_password.root_password.result
    username = "default" // This is the main superuser
  }

  verify_connection = true

  depends_on = [helm_release.redis]
}

/***************************************
* Creds Syncer
*
* This is required because unlike redis data, redis users and ACL rules are NOT
* automatically synchronized between nodes for some god forsaken reason.
* Additionally, sentinel has its own, independent ACL system that needs to be synced
* in addition to the normal redis processes :(
***************************************/

resource "kubernetes_config_map" "creds_syncer" {
  metadata {
    name      = "${random_id.id.hex}-creds-syncer-scripts"
    namespace = var.namespace
    labels    = module.secrets_sync.labels
  }
  data = {
    "creds-sync.sh" = file("${path.module}/creds-sync.sh")
  }
}

resource "kubernetes_role" "creds_syncer" {
  metadata {
    name      = "${random_id.id.hex}-creds-syncer"
    namespace = var.namespace
    labels    = module.secrets_sync.labels
  }
  rule {
    api_groups     = [""]
    resources      = ["pods"]
    verbs          = ["get", "list"]
    resource_names = [for i in range(3) : "${random_id.id.hex}-node-${i}"]
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["get", "list", "delete"]
    resource_names = [
      "${random_id.id.hex}-superuser-creds",
      "${random_id.id.hex}-admin-creds",
      "${random_id.id.hex}-reader-creds"
    ]
  }
}

resource "kubernetes_role_binding" "creds_syncer" {
  metadata {
    name      = "${random_id.id.hex}-creds-syncer"
    namespace = var.namespace
    labels    = module.secrets_sync.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.secrets_sync.service_account_name
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.creds_syncer.metadata[0].name
  }
}

module "secrets_sync" {
  source = "../kube_deployment"

  name      = "${random_id.id.hex}-creds-syncer"
  namespace = var.namespace

  containers = [
    {
      name             = "sync"
      image_registry   = "public.ecr.aws"
      image_repository = module.constants.panfactum_image_repository
      image_tag        = module.constants.panfactum_image_tag
      command          = ["/scripts/creds-sync.sh"]
      minimum_memory   = 20
    }
  ]

  common_env = {
    SRC_REDIS_HOST  = "${random_id.id.hex}-master.${var.namespace}"
    SRC_REDIS_PORT  = 6379
    REDIS_NAMESPACE = var.namespace
    REDIS_ID        = module.util.labels.id
    REDIS_STS_NAME  = random_id.id.hex
    LOGGING_ENABLED = var.creds_syncer_logging_enabled ? 1 : 0
  }

  common_secrets = {
    REDISCLI_AUTH = random_password.root_password.result
  }

  extra_pod_annotations = {
    "config.linkerd.io/proxy-memory-request" = "5Mi"
    "config.linkerd.io/proxy-memory-limit"   = "25Mi"
  }

  config_map_mounts = {
    "${kubernetes_config_map.creds_syncer.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }

  vpa_enabled              = var.vpa_enabled
  controller_nodes_enabled = true

  depends_on = [helm_release.redis]
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
  service_account           = random_id.id.hex
  service_account_namespace = var.namespace
  vault_policy_hcl          = data.vault_policy_document.vault_secrets.hcl
  audience                  = "vault"
}

resource "kubectl_manifest" "vault_connection" {
  yaml_body = yamlencode({
    apiVersion = "secrets.hashicorp.com/v1beta1"
    kind       = "VaultConnection"
    metadata = {
      name      = random_id.id.hex
      namespace = var.namespace
      labels    = module.util.labels
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
      name      = random_id.id.hex
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      vaultConnectionRef = random_id.id.hex
      method             = "kubernetes"
      mount              = "kubernetes"
      allowedNamespaces  = [var.namespace]
      kubernetes = {
        role           = module.vault_auth_vault_secrets.role_name
        serviceAccount = random_id.id.hex
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
      name      = "${random_id.id.hex}-${each.key}-creds"
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      vaultAuthRef   = random_id.id.hex
      mount          = "db"
      path           = each.value
      renewalPercent = 50
      destination = {
        create = true
        name   = "${random_id.id.hex}-${each.key}-creds"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.vault_auth]
}

/***************************************
* Disruption Windows
***************************************/

module "disruption_window_controller" {
  count  = var.voluntary_disruption_window_enabled ? 1 : 0
  source = "../kube_disruption_window_controller"

  namespace                   = var.namespace
  vpa_enabled                 = var.vpa_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled

  cron_schedule = var.voluntary_disruption_window_cron_schedule
}

/***************************************
* Image Cache
***************************************/

module "image_cache" {
  count  = var.node_image_cached_enabled ? 1 : 0
  source = "../kube_node_image_cache"

  images = [
    {
      registry          = "docker.io"
      repository        = "bitnami/redis"
      tag               = "7.4.1-debian-12-r2"
      arm_nodes_enabled = var.arm_nodes_enabled
    },
    {
      registry          = "docker.io"
      repository        = "bitnami/redis-sentinel"
      tag               = "7.4.1-debian-12-r2"
      arm_nodes_enabled = var.arm_nodes_enabled
    },
    {
      registry          = "docker.io"
      repository        = "bitnami/redis-exporter"
      tag               = "1.66.0-debian-12-r2"
      arm_nodes_enabled = var.arm_nodes_enabled
    },
    {
      registry          = "docker.io"
      repository        = "bitnami/kubectl"
      tag               = "1.31.2-debian-12-r6"
      arm_nodes_enabled = var.arm_nodes_enabled
    }
  ]
}