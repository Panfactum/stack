// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
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
  name      = "authentik"
  namespace = module.namespace.namespace
  server_matching_labels = {
    id = random_id.server_id.hex
  }
  worker_matching_labels = {
    id = random_id.worker_id.hex
  }
}

data "aws_region" "current" {}

resource "random_id" "server_id" {
  prefix      = "authentik-server-"
  byte_length = 8
}

resource "random_id" "worker_id" {
  prefix      = "authentik-worker-"
  byte_length = 8
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "labels_server" {
  source = "../kube_labels"

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = merge(var.extra_tags, local.server_matching_labels)
}

module "constants_server" {
  source = "../constants"

  matching_labels = local.server_matching_labels

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "labels_worker" {
  source = "../kube_labels"

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = merge(var.extra_tags, local.worker_matching_labels)
}

module "constants_worker" {
  source = "../constants"

  matching_labels = local.worker_matching_labels

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

/***************************************
* Database Backend
***************************************/

module "database" {
  source = "../kube_pg_cluster"

  eks_cluster_name           = var.eks_cluster_name
  pg_cluster_namespace       = local.namespace
  pg_storage_gb              = 10
  pg_memory_mb               = 1000
  pg_cpu_millicores          = 250
  pg_instances               = 2
  ip_allow_list              = var.ip_allow_list
  pull_through_cache_enabled = var.pull_through_cache_enabled
  pgbouncer_pool_mode        = "transaction" // See https://github.com/goauthentik/authentik/issues/9152

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}


/***************************************
* Redis Backend
***************************************/

module "redis" {
  source = "../kube_redis_sentinel"

  namespace                  = local.namespace
  replica_count              = 3
  disruptions_enabled        = true
  persistence_enabled        = false
  pull_through_cache_enabled = var.pull_through_cache_enabled
  vpa_enabled                = var.vpa_enabled

  // This is required due to this bug:
  // https://github.com/Panfactum/stack/issues/17
  unsafe_tls_disabled = true

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}


/***************************************
* Authentik Helm Chart
***************************************/

// This should never change
resource "random_password" "secret_id" {
  length  = 64
  special = false
}

// Initial password for the root akadmin user
// Will only be used on the first apply
resource "random_password" "bootstrap_password" {
  length  = 64
  special = false
}

// Initial API token for the root akadmin user
// Will only be used on the first apply
resource "random_password" "bootstrap_token" {
  length  = 64
  special = false
}

resource "kubernetes_secret" "bootstrap_creds" {
  metadata {
    name      = "bootstrap-creds"
    namespace = local.namespace
    labels    = module.labels_server.kube_labels
  }
  data = {
    password = random_password.bootstrap_password.result
    token    = random_password.bootstrap_token.result
  }
}

resource "helm_release" "authentik" {
  namespace       = local.namespace
  name            = "authentik"
  repository      = "https://charts.goauthentik.io/"
  chart           = "authentik"
  version         = var.authentik_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      fullnameOverride = "authentik"

      global = {
        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"}/goauthentik/server"
        }
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
        env = [
          // Authentik Settings
          {
            name  = "AUTHENTIK_COOKIE_DOMAIN"
            value = var.domain
          },
          {
            name  = "AUTHENTIK_DISABLE_UPDATE_CHECK"
            value = "true"
          },

          // Redis Settings
          {
            name  = "AUTHENTIK_REDIS__TLS"
            value = "false"
          },

          // Postgres Settings
          {
            name  = "AUTHENTIK_POSTGRESQL__USE_PGBOUNCER"
            value = "true"
          },
          {
            name  = "AUTHENTIK_POSTGRESQL__SSLROOTCERT"
            value = "/etc/certs/pg/ca.crt"
          },
          {
            name  = "AUTHENTIK_POSTGRESQL__SSLMODE"
            value = "verify-full"
          },

          // Bootstrap Settings
          // https://docs.goauthentik.io/docs/installation/automated-install
          {
            name  = "AUTHENTIK_BOOTSTRAP_EMAIL"
            value = var.akadmin_email
          },
          {
            name = "AUTHENTIK_BOOTSTRAP_TOKEN"
            valueFrom = {
              secretKeyRef = {
                name = kubernetes_secret.bootstrap_creds.metadata[0].name
                key  = "token"
              }
            }
          },
          {
            name = "AUTHENTIK_BOOTSTRAP_PASSWORD"
            valueFrom = {
              secretKeyRef = {
                name = kubernetes_secret.bootstrap_creds.metadata[0].name
                key  = "password"
              }
            }
          }
        ]
      }

      authentik = {
        secret_key = random_password.secret_id.result
        error_reporting = {
          enabled = var.error_reporting_enabled
        }
        postgresql = {
          name     = module.database.database
          user     = module.database.superuser_username
          password = module.database.superuser_password
          host     = module.database.pooler_rw_service_name
          port     = module.database.pooler_rw_service_port
        }
        redis = {
          host     = module.redis.redis_master_host
          username = module.redis.superuser_name
          password = module.redis.superuser_password
        }
        email = {
          host     = var.smtp_host
          port     = 587
          username = var.smtp_user
          password = var.smtp_password
          use_tls  = true
          timeout  = 30
          from     = var.email_from_address
        }
      }

      server = {
        podLabels = module.labels_server.kube_labels
        ingress = {
          enabled = false // We use our own ingress module
        }

        replicas = 2

        priorityClassName = module.constants_server.database_priority_class_name
        affinity = merge(
          module.constants_server.controller_node_with_burstable_affinity_helm,
          module.constants_server.pod_anti_affinity_helm
        )
        tolerations               = module.constants_server.burstable_node_toleration_helm
        topologySpreadConstraints = module.constants_server.topology_spread_zone_preferred

        service = {
          labels = module.labels_server.kube_labels
        }

        volumes = [
          {
            name = "postgres-certs"
            secret = {
              secretName = module.database.server_certs_secret
              optional   = false
              items = [
                {
                  key  = "ca.crt"
                  path = "ca.crt"
                }
              ]
            }
          }
        ]
        volumeMounts = [
          {
            name      = "postgres-certs"
            mountPath = "/etc/certs/pg"
            readOnly  = true
          }
        ]

        resources = {
          requests = {
            memory = "500Mi"
          }
          limits = {
            memory = "650Mi"
          }
        }
      }

      worker = {
        podLabels = module.labels_worker.kube_labels

        replicas          = 1 // We only need one worker as it only processes background jobs
        priorityClassName = module.constants_worker.database_priority_class_name
        affinity = merge(
          module.constants_worker.controller_node_with_burstable_affinity_helm,
          module.constants_worker.pod_anti_affinity_helm
        )
        tolerations               = module.constants_worker.burstable_node_toleration_helm
        topologySpreadConstraints = module.constants_server.topology_spread_zone_preferred


        volumes = [
          {
            name = "postgres-certs"
            secret = {
              secretName = module.database.server_certs_secret
              optional   = false
              items = [
                {
                  key  = "ca.crt"
                  path = "ca.crt"
                }
              ]
            }
          }
        ]
        volumeMounts = [
          {
            name      = "postgres-certs"
            mountPath = "/etc/certs/pg"
            readOnly  = true
          }
        ]

        resources = {
          requests = {
            memory = "1000Mi"
          }
          limits = {
            memory = "1300Mi"
          }
        }
      }

      postgresql = {
        enabled = false // We use our own postgres module
      }

      redis = {
        enabled = false // We use our own redis module
      }

    })
  ]

  depends_on = [
    module.database,
    module.redis
  ]
}

resource "kubernetes_manifest" "pdb_server" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "authentik-server"
      namespace = local.namespace
      labels    = module.labels_server.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.server_matching_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.authentik]
}

resource "kubernetes_manifest" "pdb_worker" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "authentik-worker"
      namespace = local.namespace
      labels    = module.labels_worker.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.worker_matching_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.authentik]
}

resource "kubernetes_manifest" "vpa_server" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "authentik-server"
      namespace = local.namespace
      labels    = module.labels_server.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "authentik-server"
      }
    }
  }
  depends_on = [helm_release.authentik]
}

resource "kubernetes_manifest" "vpa_worker" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "authentik-worker"
      namespace = local.namespace
      labels    = module.labels_worker.kube_labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "worker"
          minAllowed = {
            memory = "256Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "authentik-worker"
      }
    }
  }
  depends_on = [helm_release.authentik]
}


/***************************************
* Authentik Ingress
***************************************/

module "ingress" {
  count     = var.ingress_enabled ? 1 : 0
  source    = "../kube_ingress"
  namespace = local.namespace
  name      = "authentik"
  ingress_configs = [{
    domains      = [var.domain]
    service      = "authentik-server"
    service_port = 80
  }]
  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = true
  permissions_policy_enabled     = true
  csp_enabled                    = true

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local

  depends_on = [helm_release.authentik]
}