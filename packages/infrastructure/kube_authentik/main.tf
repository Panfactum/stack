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
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
}

locals {
  name      = "authentik"
  namespace = module.namespace.namespace
}

data "aws_region" "current" {}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "constants" {
  source = "../kube_constants"
}

module "util_server" {
  source                               = "../kube_workload_utility"
  workload_name                        = "authentik-server"
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  topology_spread_strict               = var.enhanced_ha_enabled
  topology_spread_enabled              = var.enhanced_ha_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  burstable_nodes_enabled              = true
  arm_nodes_enabled                    = true

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

module "util_worker" {
  source                               = "../kube_workload_utility"
  workload_name                        = "authentik-worker"
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  topology_spread_strict               = var.enhanced_ha_enabled
  topology_spread_enabled              = var.enhanced_ha_enabled
  burstable_nodes_enabled              = true
  arm_nodes_enabled                    = true

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

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

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
* Database Backend
***************************************/

module "database" {
  source = "../kube_pg_cluster"

  eks_cluster_name            = var.eks_cluster_name
  pg_cluster_namespace        = local.namespace
  pg_storage_gb               = 10
  pg_memory_mb                = 1000
  pg_cpu_millicores           = 250
  pg_instances                = 2
  pg_shutdown_timeout         = 30
  aws_iam_ip_allow_list       = var.aws_iam_ip_allow_list
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  pgbouncer_pool_mode         = "transaction" // See https://github.com/goauthentik/authentik/issues/9152
  burstable_instances_enabled = true
  arm_instances_enabled       = true
  monitoring_enabled          = var.monitoring_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  enhanced_ha_enabled         = var.enhanced_ha_enabled

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
* Redis Backend
***************************************/

module "redis" {
  source = "../kube_redis_sentinel"

  namespace                   = local.namespace
  replica_count               = 3
  burstable_instances_enabled = true
  arm_instances_enabled       = true
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  vpa_enabled                 = var.vpa_enabled
  monitoring_enabled          = var.monitoring_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  enhanced_ha_enabled         = var.enhanced_ha_enabled

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
* Email Templates
***************************************/

resource "kubernetes_config_map" "email_templates" {
  metadata {
    name      = "email-templates"
    namespace = local.namespace
    labels    = module.util_server.labels
  }
  lifecycle {
    ignore_changes = [data]
  }
}

/***************************************
* Media Templates
***************************************/

resource "kubernetes_config_map" "media" {
  metadata {
    name      = "media"
    namespace = local.namespace
    labels    = module.util_server.labels
  }
  lifecycle {
    ignore_changes = [data]
  }
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
    labels    = module.util_server.labels
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
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "authentik"

      global = {
        image = {
          repository = "${module.pull_through.github_registry}/goauthentik/server"
        }
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
        serviceAccount = {
          create = true
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
          {
            name  = "AUTHENTIK_LOG_LEVEL",
            value = var.log_level
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
        log_level  = var.log_level
        secret_key = random_password.secret_id.result
        error_reporting = {
          enabled = var.error_reporting_enabled
        }
        postgresql = {
          name     = module.database.database
          user     = module.database.superuser_username
          password = module.database.superuser_password // TODO: Pass in as environment variable
          host     = module.database.pooler_rw_service_name
          port     = module.database.pooler_rw_service_port
        }
        redis = {
          host     = module.redis.redis_master_host
          username = module.redis.superuser_name
          password = module.redis.superuser_password // TODO: Pass in as environment variable
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
        podLabels = merge(
          module.util_server.labels,
          {
            customizationHash = md5(join("", [
              for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
            ]))
          }
        )
        ingress = {
          enabled = false // We use our own ingress module
        }

        replicas = 2
        deploymentStrategy = {
          type = "Recreate"
        }
        priorityClassName         = module.constants.database_priority_class_name
        affinity                  = module.util_server.affinity
        tolerations               = module.util_server.tolerations
        topologySpreadConstraints = module.util_server.topology_spread_constraints

        service = {
          labels = module.util_server.labels
        }

        metrics = {
          enabled = var.monitoring_enabled
          service = {
            labels = module.util_server.labels
          }
          serviceMonitor = {
            enabled  = var.monitoring_enabled
            interval = "60s"
            labels   = module.util_server.labels
          }
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
          },
          {
            name = "email-templates"
            configMap = {
              name     = kubernetes_config_map.email_templates.metadata[0].name
              optional = false
            }
          },
          {
            name = "media"
            configMap = {
              name     = kubernetes_config_map.media.metadata[0].name
              optional = false
            }
          }
        ]
        volumeMounts = [
          {
            name      = "postgres-certs"
            mountPath = "/etc/certs/pg"
            readOnly  = true
          },
          {
            name      = "email-templates"
            mountPath = "/templates"
            readOnly  = true
          },
          {
            name      = "media"
            mountPath = "/media/public"
            readOnly  = true
          }
        ]

        resources = {
          requests = {
            memory = "1250Mi"
          }
          limits = {
            memory = "${floor(1250 * 1.3)}Mi"
          }
        }
      }

      worker = {
        podLabels = merge(
          module.util_worker.labels,
          {
            customizationHash = md5(join("", [
              for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
            ]))
          }
        )

        replicas                  = 1 // We only need one worker as it only processes background jobs
        priorityClassName         = module.constants.database_priority_class_name
        affinity                  = module.util_server.affinity
        tolerations               = module.util_server.tolerations
        topologySpreadConstraints = module.util_server.topology_spread_constraints


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
          },
          {
            name = "email-templates"
            configMap = {
              name     = kubernetes_config_map.email_templates.metadata[0].name
              optional = false
            }
          },
          {
            name = "media"
            configMap = {
              name     = kubernetes_config_map.media.metadata[0].name
              optional = false
            }
          }
        ]
        volumeMounts = [
          {
            name      = "postgres-certs"
            mountPath = "/etc/certs/pg"
            readOnly  = true
          },
          {
            name      = "email-templates"
            mountPath = "/templates"
            readOnly  = true
          },
          {
            name      = "media"
            mountPath = "/media/public"
            readOnly  = true
          }
        ]

        resources = {
          requests = {
            memory = "700Mi"
          }
          limits = {
            memory = "${floor(700 * 1.3)}Mi"
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

  dynamic "postrender" {
    for_each = var.panfactum_scheduler_enabled ? ["enabled"] : []
    content {
      binary_path = "${path.module}/kustomize/kustomize.sh"
    }
  }

  depends_on = [
    module.database,
    module.redis
  ]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "authentik-dashboard"
    labels = merge(module.util_server.labels, { "grafana_dashboard" = "1" })
  }
  data = {
    "authentik.json" = file("${path.module}/dashboard.json")
  }
}

resource "kubectl_manifest" "pdb_server" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "authentik-server"
      namespace = local.namespace
      labels    = module.util_server.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_server.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.authentik]
}

resource "kubectl_manifest" "pdb_worker" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "authentik-worker"
      namespace = local.namespace
      labels    = module.util_worker.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_worker.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.authentik]
}

resource "kubectl_manifest" "vpa_server" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "authentik-server"
      namespace = local.namespace
      labels    = module.util_server.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "server"
          minAllowed = {
            memory = "1250Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "authentik-server"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.authentik]
}

resource "kubectl_manifest" "vpa_worker" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "authentik-worker"
      namespace = local.namespace
      labels    = module.util_worker.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "worker"
          minAllowed = {
            memory = "700Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "authentik-worker"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.authentik]
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
  cross_origin_isolation_enabled = false
  cross_origin_embedder_policy   = "credentialless" // Required to load gravatar images
  permissions_policy_enabled     = true
  csp_enabled                    = true
  cross_origin_opener_policy     = "same-origin-allow-popups" // Required for SSO login pop-ups

  # TODO: Open an issue in the repo to report that this
  # unsafe configuration is required
  csp_style_src  = "'self' 'unsafe-inline'"
  csp_script_src = "'self' 'unsafe-inline'"
  csp_img_src    = "'self' data: https://*.gravatar.com/" // Allow gravatar profile images

  # Allows webauthn credentialing
  permissions_policy_publickey_credentials_create = "(self \"https://*.${var.domain}\")"
  permissions_policy_publickey_credentials_get    = "(self \"https://*.${var.domain}\")"

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate

  depends_on = [helm_release.authentik]
}
