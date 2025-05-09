terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    aws = {
      source                = "hashicorp/aws"
      version               = "5.80.0"
      configuration_aliases = [aws.global]
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  name      = "authentik"
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_authentik"
}

module "constants" {
  source = "../kube_constants"
}

module "util_server" {
  source = "../kube_workload_utility"

  workload_name                        = "authentik-server"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  az_spread_preferred                  = var.sla_target >= 2
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_worker" {
  source = "../kube_workload_utility"

  workload_name                        = "authentik-worker"
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  az_spread_preferred                  = var.sla_target >= 2
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "namespace" {
  source = "../kube_namespace"

  namespace = var.namespace
}

/***************************************
* Database Backend
***************************************/

module "database" {
  source = "../kube_pg_cluster"

  pg_cluster_namespace                 = local.namespace
  pg_initial_storage_gb                = 10
  pg_instances                         = 2
  pg_smart_shutdown_timeout            = 1
  pg_minimum_memory_mb                 = 500
  aws_iam_ip_allow_list                = var.aws_iam_ip_allow_list
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  pgbouncer_pool_mode                  = "transaction" // See https://github.com/goauthentik/authentik/issues/9152
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  controller_nodes_enabled             = false // should not run on controller nodes which can cause disruptions
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.sla_target == 3

  pg_backup_directory      = var.db_backup_directory
  pg_recovery_mode_enabled = var.db_recovery_mode_enabled
  pg_recovery_directory    = var.db_recovery_directory
  pg_recovery_target_time  = var.db_recovery_target_time
  vpa_enabled              = var.vpa_enabled
}


/***************************************
* Redis Backend
***************************************/

module "redis" {
  source = "../kube_redis_sentinel"

  namespace                            = local.namespace
  replica_count                        = 3
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  vpa_enabled                          = var.vpa_enabled
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = false // Not needed; a small chance of disruption is entirely fine
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

resource "kubernetes_config_map_v1_data" "email_templates" {
  metadata {
    name      = kubernetes_config_map.email_templates.metadata[0].name
    namespace = local.namespace
  }
  data = {
    "recovery.html" = templatefile("${path.module}/email_templates/recovery.html", { organization_name = var.organization_name })
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
  atomic          = var.wait
  cleanup_on_fail = var.wait
  wait            = var.wait
  force_update    = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "authentik"

      global = {

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
          {
            name  = "AUTHENTIK_REDIS__HOST"
            value = module.redis.redis_master_host
          },
          {
            name = "AUTHENTIK_REDIS__USERNAME"
            valueFrom = {
              secretKeyRef = {
                name     = module.redis.superuser_creds_secret
                key      = "username"
                optional = false
              }
            }
          },
          {
            name = "AUTHENTIK_REDIS__PASSWORD"
            valueFrom = {
              secretKeyRef = {
                name     = module.redis.superuser_creds_secret
                key      = "password"
                optional = false
              }
            }
          },


          // Postgres Settings
          {
            // Us PGPOOL instead of PGBOUNCER to workaround
            // this issue: https://github.com/goauthentik/authentik/issues/12278
            name  = "AUTHENTIK_POSTGRESQL__USE_PGPOOL"
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
          {
            name = "AUTHENTIK_POSTGRESQL__USER"
            valueFrom = {
              secretKeyRef = {
                name     = module.database.superuser_creds_secret
                key      = "username"
                optional = false
              }
            }
          },
          {
            name = "AUTHENTIK_POSTGRESQL__PASSWORD"
            valueFrom = {
              secretKeyRef = {
                name     = module.database.superuser_creds_secret
                key      = "password"
                optional = false
              }
            }
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
          name = module.database.database
          host = module.database.pooler_rw_service_name
          port = module.database.pooler_rw_service_port
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

        replicas                  = 2
        priorityClassName         = module.constants.workload_important_priority_class_name
        affinity                  = module.util_server.affinity
        tolerations               = module.util_server.tolerations
        topologySpreadConstraints = module.util_server.topology_spread_constraints

        deploymentStrategy = {
          type = "RollingUpdate"
          rollingUpdate = {
            maxSurge       = 0
            maxUnavailable = 1
          }
        }

        service = {
          labels = module.util_server.labels
          annotations = {
            "retry.linkerd.io/http"    = "5xx"
            "retry.linkerd.io/limit"   = "10"
            "retry.linkerd.io/timeout" = "5s"
          }
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
        priorityClassName         = module.constants.workload_important_priority_class_name
        affinity                  = module.util_server.affinity
        tolerations               = module.util_server.tolerations
        topologySpreadConstraints = module.util_server.topology_spread_constraints

        deploymentStrategy = {
          type = "RollingUpdate"
          rollingUpdate = {
            maxSurge       = 0
            maxUnavailable = 1
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

  depends_on = [
    module.database,
    module.redis
  ]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name      = "authentik-dashboard"
    namespace = local.namespace
    labels    = merge(module.util_server.labels, { "grafana_dashboard" = "1" })
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
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
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
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
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
  domains   = [var.domain]
  ingress_configs = [{
    service      = "authentik-server"
    service_port = 80

    cdn = {
      // By default we should not cache requests
      // because they main contain sensitive information
      default_cache_behavior = {
        caching_enabled = false
      }
      path_match_behavior = {
        // Static assets can be cached
        "/static*" = {
          caching_enabled            = true
          cookies_in_cache_key       = []
          query_strings_in_cache_key = []
        }
        "/media*" = {
          caching_enabled            = true
          cookies_in_cache_key       = []
          query_strings_in_cache_key = []
        }
        "*.woff2" = {
          caching_enabled            = true
          cookies_in_cache_key       = []
          query_strings_in_cache_key = []
        }
      }
    }
  }]
  cdn_mode_enabled               = var.cdn_mode_enabled
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

  depends_on = [helm_release.authentik]
}

module "cdn" {
  count  = var.ingress_enabled && var.cdn_mode_enabled ? 1 : 0
  source = "../kube_aws_cdn"
  providers = {
    aws.global = aws.global
  }

  name           = "authentik"
  origin_configs = module.ingress[0].cdn_origin_configs
}

/***************************************
* Image Cache
***************************************/

module "image_cache" {
  count  = var.node_image_cached_enabled ? 1 : 0
  source = "../kube_node_image_cache"

  images = [
    {
      registry   = "ghcr.io"
      repository = "goauthentik/server"
      tag        = var.authentik_helm_version
    }
  ]
}

