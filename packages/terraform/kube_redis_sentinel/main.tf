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

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = merge(var.extra_tags, local.match_labels)
}

module "constants" {
  source = "../constants"

  matching_labels = local.match_labels

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

module "tls_cert" {
  source      = "../kube_internal_cert"
  common_name = random_id.id.hex
  service_names = [
    random_id.id.hex,
    "${random_id.id.hex}-master",
    "${random_id.id.hex}-headless"
  ]
  secret_name        = "${random_id.id.hex}-certs"
  namespace          = var.namespace
  include_localhost  = true
  include_subdomains = true

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

      global = {
        imageRegistry = var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"
        storageClass  = "ebs-standard"
      }

      auth = {
        enabled                   = true
        sentinel                  = true
        existingSecret            = kubernetes_secret.superuser.metadata[0].name
        existingSecretPasswordKey = "password"
      }

      tls = {
        enabled         = !var.unsafe_tls_disabled
        existingSecret  = module.tls_cert.secret_name
        authClients     = false
        certFilename    = "tls.crt"
        certKeyFilename = "tls.key"
        certCAFilename  = "ca.crt"
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
          var.unsafe_tls_disabled ? [] : ["--tls-port", "6379", "--port", "0"],
          var.persistence_enabled ? [] : ["--appendonly", "no"]
        )

        podLabels = module.kube_labels.kube_labels
        podAnnotations = {

          // This is temporarily disabled b/c of https://github.com/linkerd/linkerd2/issues/12382
          #"config.linkerd.io/opaque-ports" = "6379,26379"
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
          "config.linkerd.io/skip-inbound-ports"                = "6379,26379"
        }

        // For whatever reason the kubelet has trouble
        // running the readiness probe within the configured time
        // Fortunately, we do not really need readiness probes at all
        readinessProbe = {
          enabled = false
        }

        priorityClassName         = module.constants.database_priority_class_name
        affinity                  = module.constants.pod_anti_affinity_helm
        tolerations               = var.disruptions_enabled ? module.constants.burstable_node_toleration_helm : []
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
        enabled                  = true
        automaticClusterRecovery = true
        downAfterMilliseconds    = 1000 * 30
        failoverTimeout          = 1000 * 60 * 3


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

// This will prevent the master from begin disrupted
resource "kubernetes_manifest" "pdb_master" {
  count = var.disruptions_enabled ? 0 : 1
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
        matchLabels = merge(
          module.kube_labels.kube_labels,
          { isMaster = "true" }
        )
      }
      maxUnavailable = 0
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

resource "vault_database_secret_backend_role" "read_only" {
  backend             = "db"
  name                = "reader-${var.namespace}-${random_id.id.hex}"
  db_name             = vault_database_secret_backend_connection.redis.name
  creation_statements = [jsonencode(["%R~*", "&*", "+@all", "-@write", "-@admin", "-@dangerous"])]
  default_ttl         = 60 * 60 * 8
  max_ttl             = 60 * 60 * 8
}

resource "vault_database_secret_backend_role" "writer" {
  backend             = "db"
  name                = "writer-${var.namespace}-${random_id.id.hex}"
  db_name             = vault_database_secret_backend_connection.redis.name
  creation_statements = [jsonencode(["%RW~*", "&*", "+@all", "-@admin", "-@dangerous"])]
  default_ttl         = 60 * 60 * 8
  max_ttl             = 60 * 60 * 8
}

resource "vault_database_secret_backend_role" "admin" {
  backend             = "db"
  name                = "admin-${var.namespace}-${random_id.id.hex}"
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
    "writer-${var.namespace}-${random_id.id.hex}",
    "admin-${var.namespace}-${random_id.id.hex}",
  ]

  redis {
    host     = "${random_id.id.hex}-master.${var.namespace}"
    port     = 6379
    tls      = !var.unsafe_tls_disabled
    password = random_password.superuser_password.result
    username = "default" // This is the main superuser
  }

  verify_connection = true

  depends_on = [helm_release.redis]
}