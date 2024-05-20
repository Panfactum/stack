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
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
  }
}

locals {
  match_labels = {
    id = random_id.id.hex
  }
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

resource "random_id" "id" {
  byte_length = 2
  prefix      = "redis-"
}

module "kube_labels" {
  source = "../kube_labels"

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.match_labels)
}

module "constants" {
  source = "../constants"

  matching_labels = local.match_labels

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.match_labels)
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
resource "random_password" "superuser_password" {
  length  = 64
  special = false
}

resource "kubernetes_secret" "superuser" {
  type = "kubernetes.io/basic-auth"
  metadata {
    name      = nonsensitive("redis-superuser-${sha256(random_password.superuser_password.result)}")
    namespace = var.namespace
    labels    = module.kube_labels.kube_labels
  }
  data = {
    password = random_password.superuser_password.result
  }
}

/***************************************
* Redis
***************************************/

resource "helm_release" "redis" {
  namespace       = var.namespace
  name            = random_id.id.hex
  repository      = "https://charts.bitnami.com/bitnami"
  chart           = "redis"
  version         = var.helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  timeout         = 60 * 15

  values = [
    yamlencode({
      fullnameOverride = random_id.id.hex
      commonLabels     = module.kube_labels.kube_labels

      commonAnnotations = {
        "panfactum.com/db"             = "true"
        "panfactum.com/db-type"        = "Redis"
        "panfactum.com/reader-role"    = "reader-${var.namespace}-${random_id.id.hex}"
        "panfactum.com/admin-role"     = "admin-${var.namespace}-${random_id.id.hex}"
        "panfactum.com/superuser-role" = "superuser-${var.namespace}-${random_id.id.hex}"
        "panfactum.com/vault-mount"    = "db/${var.namespace}-${random_id.id.hex}"
        "panfactum.com/service"        = "${random_id.id.hex}-master.${var.namespace}"
        "panfactum.com/service-port"   = "6379"
      }

      global = {
        imageRegistry = var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"
        storageClass  = "ebs-standard"
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
        existingSecret            = kubernetes_secret.superuser.metadata[0].name
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
          var.persistence_enabled ? [] : ["--appendonly", "no"],
          var.lfu_cache_enabled ? ["--maxmemory", "$MEMORY_REQUEST", "--maxmemory-policy", "allkeys-lfu", "--activedefrag", "yes"] : [],
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

        podLabels = merge(
          module.kube_labels.kube_labels,
          module.constants.disable_lifetime_eviction_label
        )
        podAnnotations = {
          "config.linkerd.io/opaque-ports"                      = "6379,26379"
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }

        // For whatever reason the kubelet has trouble
        // running the readiness probe within the configured time
        // Fortunately, we do not really need readiness probes at all
        readinessProbe = {
          enabled = false
        }

        priorityClassName         = module.constants.database_priority_class_name
        affinity                  = (var.burstable_instances_enabled || var.spot_instances_enabled) ? module.constants.pod_anti_affinity_instance_type_helm : module.constants.pod_anti_affinity_helm
        tolerations               = var.burstable_instances_enabled ? module.constants.burstable_node_toleration_helm : var.spot_instances_enabled ? module.constants.spot_node_toleration_helm : null
        topologySpreadConstraints = module.constants.topology_spread_zone_strict

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
          enabled   = var.persistence_enabled
          size      = "${var.persistence_size_gb}Gi"
          sizeLimit = "100Mi" // only used by the emptydir when persistence is disabled
          persistentVolumeClaimRetentionPolicy = {
            enabled     = true
            whenScaled  = "Delete"
            whenDeleted = "Delete"
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
    })
  ]
}

resource "kubernetes_manifest" "pdb" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = random_id.id.hex
      namespace = var.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = module.kube_labels.kube_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.redis]
}

resource "kubernetes_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = random_id.id.hex
      namespace = var.namespace
      labels    = module.kube_labels.kube_labels
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
  }
  depends_on = [helm_release.redis]
}


/***************************************
* Vault Authentication
***************************************/

resource "vault_database_secret_backend_role" "reader" {
  backend             = "db"
  name                = "reader-${var.namespace}-${random_id.id.hex}"
  db_name             = vault_database_secret_backend_connection.redis.name
  creation_statements = [jsonencode(["%R~*", "&*", "+@all", "-@write", "-@admin", "-@dangerous"])]
  default_ttl         = 60 * 60 * 8
  max_ttl             = 60 * 60 * 8
}

resource "vault_database_secret_backend_role" "admin" {
  backend             = "db"
  name                = "admin-${var.namespace}-${random_id.id.hex}"
  db_name             = vault_database_secret_backend_connection.redis.name
  creation_statements = [jsonencode(["%RW~*", "&*", "+@all", "-@admin", "-@dangerous"])]
  default_ttl         = 60 * 60 * 8
  max_ttl             = 60 * 60 * 8
}

resource "vault_database_secret_backend_role" "superuser" {
  backend             = "db"
  name                = "superuser-${var.namespace}-${random_id.id.hex}"
  db_name             = vault_database_secret_backend_connection.redis.name
  creation_statements = [jsonencode(["~*", "&*", "+@all", "-acl|deluser", "-acl|genpass", "-acl|log", "-acl|setuser"])]
  default_ttl         = 60 * 60 * 8
  max_ttl             = 60 * 60 * 8
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
    password = random_password.superuser_password.result
    username = "default" // This is the main superuser
  }

  verify_connection = true

  depends_on = [helm_release.redis]
}
