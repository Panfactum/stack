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
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

data "aws_region" "current" {}

locals {

  name      = "logging"
  namespace = module.namespace.namespace

  default_resources = {
    requests = {
      memory = "300Mi"
    }
    limits = {
      memory = "390Mi"
    }
  }

  kustomization_labels = {
    customizationHash = md5(join("", [
      for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
    ]))
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_logging"
}

module "util_read" {
  source = "../kube_workload_utility"

  workload_name                        = "loki-read"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_required                   = var.enhanced_ha_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_write" {
  source = "../kube_workload_utility"

  workload_name                        = "loki-write"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_required                   = true // stateful
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_backend" {
  source = "../kube_workload_utility"

  workload_name                        = "loki-backend"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_required                   = true // stateful
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_canary" {
  source = "../kube_workload_utility"

  workload_name                        = "loki-canary"
  panfactum_scheduler_enabled          = false
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  instance_type_anti_affinity_required = false
  az_spread_preferred                  = false
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name
}

/***************************************
* Cache
***************************************/

module "redis_cache" {
  source = "../kube_redis_sentinel"

  namespace                            = local.namespace
  replica_count                        = 3
  lfu_cache_enabled                    = true
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  vpa_enabled                          = var.vpa_enabled
  minimum_memory_mb                    = 1000
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
}

/***************************************
* Logs Storage
***************************************/
resource "random_id" "logs_bucket_name" {
  byte_length = 8
  prefix      = "loki-chunks-"
}

module "logs_bucket" {
  source      = "../aws_s3_private_bucket"
  bucket_name = random_id.logs_bucket_name.hex
  description = "Long term logs storage"

  intelligent_transitions_enabled = true
}

resource "random_id" "loki_ruler_bucket_name" {
  byte_length = 8
  prefix      = "loki-ruler-"
}

module "loki_ruler_bucket" {
  source      = "../aws_s3_private_bucket"
  bucket_name = random_id.loki_ruler_bucket_name.hex
  description = "Loki ruler storage"

  intelligent_transitions_enabled = true
}

data "aws_iam_policy_document" "loki" {
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject"
    ]
    resources = [
      "${module.logs_bucket.bucket_arn}/*",
      "${module.loki_ruler_bucket.bucket_arn}/*"
    ]
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket"
    ]
    resources = [
      module.logs_bucket.bucket_arn,
      module.loki_ruler_bucket.bucket_arn
    ]
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:GetBucketLocation"
    ]
    resources = ["arn:aws:s3:::*"]
  }
}

/***************************************
* Loki
***************************************/

resource "kubernetes_service_account" "loki" {
  metadata {
    name      = "loki"
    namespace = local.namespace
    labels    = module.util_backend.labels
  }
}

module "loki_aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.loki.metadata[0].name
  service_account_namespace = local.namespace
  iam_policy_json           = data.aws_iam_policy_document.loki.json
  ip_allow_list             = var.aws_iam_ip_allow_list
}

resource "helm_release" "loki" {
  namespace       = local.namespace
  name            = "loki"
  repository      = "https://grafana.github.io/helm-charts"
  chart           = "loki"
  version         = var.loki_chart_version
  recreate_pods   = false
  atomic          = true
  force_update    = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5
  timeout         = 60 * 10

  values = [
    yamlencode({
      fullnameOverride = "loki"
      deploymentMode   = "SimpleScalable"
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.loki.metadata[0].name
      }
      loki = {
        auth_enabled = false
        annotations = {
          "reloader.stakater.com/auto" = "true"
        }
        storage = {
          bucketNames = {
            chunks = module.logs_bucket.bucket_name
            ruler  = module.loki_ruler_bucket.bucket_name
          }
        }
        structuredConfig = {
          auth_enabled = false
          common = {
            compactor_address  = "http://loki-backend.${local.namespace}.svc.cluster.local:3100"
            path_prefix        = "/var/loki"
            replication_factor = 3
            storage = {
              s3 = {
                bucketnames      = module.logs_bucket.bucket_name
                insecure         = false
                region           = data.aws_region.current.name
                s3               = "s3://${data.aws_region.current.name}"
                s3forcepathstyle = false
              }
            }
          }

          frontend = {
            scheduler_address         = "loki-backend.${local.namespace}.svc.cluster.local:9095"
            tail_proxy_url            = "http://loki-backend.${local.namespace}.svc.cluster.local:3100"
            graceful_shutdown_timeout = "90s"
            compress_responses        = true
            log_queries_longer_than   = "5s"
          }

          frontend_worker = {
            scheduler_address = "loki-backend.${local.namespace}.svc.cluster.local:9095"
          }

          compactor = {
            compaction_interval    = "20m"
            retention_enabled      = true
            delete_request_store   = "s3"
            retention_delete_delay = "30m"
          }

          index_gateway = {
            mode = "simple"
          }

          limits_config = {
            max_cache_freshness_per_query = "10m"
            query_timeout                 = "60s"
            reject_old_samples            = true
            reject_old_samples_max_age    = "24h"
            split_queries_by_interval     = "15m"
            volume_enabled                = true
            retention_period              = "${var.log_retention_period_hours}h"
          }


          chunk_store_config = {
            chunk_cache_config = {
              default_validity = "1h"
              redis = {
                endpoint   = "${module.redis_cache.redis_master_host}:${module.redis_cache.redis_port}"
                db         = 0
                expiration = "1h"
                username   = "$${REDIS_USERNAME}"
                password   = "$${REDIS_PASSWORD}"
              }
            }
          }

          memberlist = {
            join_members = ["loki-memberlist"]
          }

          pattern_ingester = {
            enabled = false
          }

          query_range = {
            align_queries_with_step       = true
            parallelise_shardable_queries = false # Enabling this seems to cause queries to hang about 20% of the time
            cache_results                 = true
            results_cache = {
              compression = "snappy"
              cache = {
                default_validity = "1h"
                redis = {
                  endpoint   = "${module.redis_cache.redis_master_host}:${module.redis_cache.redis_port}"
                  db         = 1
                  expiration = "1h"
                  username   = "$${REDIS_USERNAME}"
                  password   = "$${REDIS_PASSWORD}"
                }
              }
            }

            cache_index_stats_results = true
            index_stats_results_cache = {
              compression = "snappy"
              cache = {
                default_validity = "1h"
                redis = {
                  endpoint   = "${module.redis_cache.redis_master_host}:${module.redis_cache.redis_port}"
                  db         = 2
                  expiration = "1h"
                  username   = "$${REDIS_USERNAME}"
                  password   = "$${REDIS_PASSWORD}"
                }
              }
            }

            cache_volume_results = true
            volume_results_cache = {
              compression = "snappy"
              cache = {
                default_validity = "1h"
                redis = {
                  endpoint   = "${module.redis_cache.redis_master_host}:${module.redis_cache.redis_port}"
                  db         = 3
                  expiration = "1h"
                  username   = "$${REDIS_USERNAME}"
                  password   = "$${REDIS_PASSWORD}"
                }
              }
            }

            cache_instant_metric_results     = true
            instant_metric_query_split_align = true
            instant_metric_results_cache = {
              compression = "snappy"
              cache = {
                default_validity = "1h"
                redis = {
                  endpoint   = "${module.redis_cache.redis_master_host}:${module.redis_cache.redis_port}"
                  db         = 4
                  expiration = "1h"
                  username   = "$${REDIS_USERNAME}"
                  password   = "$${REDIS_PASSWORD}"
                }
              }
            }

            cache_series_results = true
            series_results_cache = {
              compression = "snappy"
              cache = {
                default_validity = "1h"
                redis = {
                  endpoint   = "${module.redis_cache.redis_master_host}:${module.redis_cache.redis_port}"
                  db         = 5
                  expiration = "1h"
                  username   = "$${REDIS_USERNAME}"
                  password   = "$${REDIS_PASSWORD}"
                }
              }
            }

            cache_label_results = true
            label_results_cache = {
              compression = "snappy"
              cache = {
                default_validity = "1h"
                redis = {
                  endpoint   = "${module.redis_cache.redis_master_host}:${module.redis_cache.redis_port}"
                  db         = 6
                  expiration = "1h"
                  username   = "$${REDIS_USERNAME}"
                  password   = "$${REDIS_PASSWORD}"
                }
              }
            }
          }

          ruler = {
            storage = {
              s3 = {
                bucketnames      = module.loki_ruler_bucket.bucket_name
                insecure         = false
                region           = data.aws_region.current.name
                s3               = "s3://${data.aws_region.current.name}"
                s3forcepathstyle = false
              }
            }
          }
          runtime_config = {
            file = "/etc/loki/runtime-config/runtime-config.yaml"
          }

          schema_config = {
            configs = [{
              from = "2020-09-07"
              index = {
                period = "24h"
                prefix = "index_"
              }

              object_store = "s3"
              schema       = "v13"
              store        = "tsdb"
            }]
          }

          server = {
            grpc_listen_port          = 9095
            http_listen_port          = 3100
            http_server_read_timeout  = "30s"
            http_server_write_timeout = "30s"
            http_server_idle_timeout  = "50s"
          }


          storage_config = {
            tsdb_shipper = {
              index_gateway_client = {
                server_address = "dns+loki-backend-headless.${local.namespace}.svc.cluster.local:9095"
              }
            }

            hedging = {
              at             = "250ms"
              max_per_second = 20
              up_to          = 3
            }
            disable_broad_index_queries = true
            index_queries_cache_config = {
              default_validity = "1h"
              redis = {
                endpoint   = "${module.redis_cache.redis_master_host}:${module.redis_cache.redis_port}"
                db         = 7
                expiration = "1h"
                username   = "$${REDIS_USERNAME}"
                password   = "$${REDIS_PASSWORD}"
              }
            }
          }
          tracing = {
            enabled = false
          }
        }
      }

      backend = {
        replicas = 3
        podLabels = merge(
          module.util_backend.labels,
          local.kustomization_labels
        )
        serviceLabels = module.util_backend.labels
        extraArgs = [
          "-config.expand-env=true",
          "--log.level=${var.log_level}",
          "--log.format=json"
        ]
        extraEnv = [
          {
            name = "REDIS_USERNAME"
            valueFrom = {
              secretKeyRef = {
                name     = module.redis_cache.superuser_creds_secret
                key      = "username"
                optional = false
              }
            }
          },
          {
            name = "REDIS_PASSWORD"
            valueFrom = {
              secretKeyRef = {
                name     = module.redis_cache.superuser_creds_secret
                key      = "password"
                optional = false
              }
            }
          }
        ]
        priorityClassName             = module.constants.cluster_important_priority_class_name
        topologySpreadConstraints     = module.util_backend.topology_spread_constraints
        affinity                      = module.util_backend.affinity
        tolerations                   = module.util_backend.tolerations
        terminationGracePeriodSeconds = 60
        resources                     = local.default_resources
        persistence = {
          volumeClaimsEnabled            = true
          enableStatefulSetAutoDeletePVC = true
          size                           = "2Gi"
          storageClass                   = var.loki_storage_class_name
        }
      }

      read = {
        replicas = 3
        podLabels = merge(
          module.util_read.labels,
          local.kustomization_labels
        )
        serviceLabels = module.util_read.labels
        extraArgs = [
          "-config.expand-env=true",
          "--log.level=${var.log_level}",
          "--log.format=json"
        ]
        extraEnv = [
          {
            name = "REDIS_USERNAME"
            valueFrom = {
              secretKeyRef = {
                name     = module.redis_cache.superuser_creds_secret
                key      = "username"
                optional = false
              }
            }
          },
          {
            name = "REDIS_PASSWORD"
            valueFrom = {
              secretKeyRef = {
                name     = module.redis_cache.superuser_creds_secret
                key      = "password"
                optional = false
              }
            }
          }
        ]
        priorityClassName             = module.constants.cluster_important_priority_class_name
        topologySpreadConstraints     = module.util_read.topology_spread_constraints
        affinity                      = module.util_read.affinity
        tolerations                   = module.util_read.tolerations
        terminationGracePeriodSeconds = 60
        resources                     = local.default_resources
      }

      write = {
        replicas = 3
        podLabels = merge(
          module.util_write.labels,
          local.kustomization_labels
        )
        serviceLabels = module.util_write.labels
        extraArgs = [
          "-config.expand-env=true",
          "--log.level=${var.log_level}",
          "--log.format=json"
        ]
        extraEnv = [
          {
            name = "REDIS_USERNAME"
            valueFrom = {
              secretKeyRef = {
                name     = module.redis_cache.superuser_creds_secret
                key      = "username"
                optional = false
              }
            }
          },
          {
            name = "REDIS_PASSWORD"
            valueFrom = {
              secretKeyRef = {
                name     = module.redis_cache.superuser_creds_secret
                key      = "password"
                optional = false
              }
            }
          }
        ]
        priorityClassName             = module.constants.cluster_important_priority_class_name
        topologySpreadConstraints     = module.util_write.topology_spread_constraints
        affinity                      = module.util_write.affinity
        tolerations                   = module.util_write.tolerations
        terminationGracePeriodSeconds = 60
        resources                     = local.default_resources
        persistence = {
          enabled                        = true
          size                           = "2Gi"
          storageClass                   = var.loki_storage_class_name
          enableStatefulSetAutoDeletePVC = true
        }
      }

      // We do not use memcached for caching
      resultsCache = {
        enabled = false
      }
      chunksCache = {
        enabled = false
      }

      // We have our own ingress system
      gateway = {
        enabled = false
      }

      monitoring = {
        dashboards = {
          enabled = false
        }
        rules = {
          enabled   = var.monitoring_enabled
          namespace = local.namespace
        }
        serviceMonitor = {
          enabled  = var.monitoring_enabled
          interval = "60s"
          metricsInstance = {
            enabled = false
          }
        }
      }

      lokiCanary = {
        enabled = var.monitoring_enabled

        // We rely on alloy to collect the logs rather than push to Loki directly.
        // This is so the canary test accurately reflects the normal log collection pipeline.
        // As a result, this should not be deployed until Alloy is deployed.
        push = false

        service = {
          labels = module.util_canary.labels
        }
        podLabels = module.util_canary.labels
        annotations = {
          // This has a fixed amount of network activity so the memory request can be optimized
          "config.linkerd.io/proxy-memory-request" = "5Mi"
        }
        tolerations = module.util_canary.tolerations
        resources   = local.default_resources
        extraArgs = [
          "-addr=loki-read.${local.namespace}.svc.cluster.local:3100",
          "-interval=15s" // Adjust from the default of 1s to reduce log volume; since we only scrape metrics every 60s, this doesn't need to be very quick
        ]
        updateStrategy = {
          type = "RollingUpdate"
          rollingUpdate = {
            maxUnavailable = "50%"
          }
        }
      }
    })
  ]

  depends_on = [module.redis_cache]
}

resource "kubectl_manifest" "service_monitor" {
  count = var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "loki-canary"
      namespace = local.namespace
      labels    = module.util_canary.labels
    }
    spec = {
      endpoints = [{
        honorLabels = true
        interval    = "60s"
        port        = "http-metrics"
        path        = "/metrics"
        scheme      = "http"
      }]
      jobLabel = "loki-canary"
      namespaceSelector = {
        matchNames = [local.namespace]
      }
      selector = {
        matchLabels = module.util_canary.match_labels
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.loki]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "loki-dashboard"
    labels = merge(module.util_backend.labels, { "grafana_dashboard" = "1" })
  }
  data = {
    "loki-metrics.json" = file("${path.module}/dashboards/loki_metrics.json"),
    "loki-canary.json"  = file("${path.module}/dashboards/loki_canary.json")
  }
}

/***************************************
* Autoscaling
***************************************/

resource "kubernetes_annotations" "loki_write" {
  count       = 3
  api_version = "v1"
  kind        = "PersistentVolumeClaim"
  metadata {
    name      = "data-loki-write-${count.index}"
    namespace = local.namespace
  }
  annotations = {
    "velero.io/exclude-from-backup"   = "true"
    "resize.topolvm.io/storage_limit" = "100Gi"
    "resize.topolvm.io/increase"      = "50%"
    "resize.topolvm.io/threshold"     = "20%"
  }

  depends_on = [helm_release.loki]
}

resource "kubernetes_annotations" "loki_backend" {
  count       = 3
  api_version = "v1"
  kind        = "PersistentVolumeClaim"
  metadata {
    name      = "data-loki-backend-${count.index}"
    namespace = local.namespace
  }
  annotations = {
    "velero.io/exclude-from-backup"   = "true"
    "resize.topolvm.io/storage_limit" = "100Gi"
    "resize.topolvm.io/increase"      = "50%"
    "resize.topolvm.io/threshold"     = "20%"
  }

  depends_on = [helm_release.loki]
}

resource "kubectl_manifest" "vpa_loki_write" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "loki-write"
      namespace = local.namespace
      labels    = module.util_write.labels
    }
    spec = {
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resource          = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "loki-write"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.loki]
}

resource "kubectl_manifest" "vpa_loki_backend" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "loki-backend"
      namespace = local.namespace
      labels    = module.util_backend.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "loki"
          minAllowed = {
            memory = "500Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resource          = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "loki-backend"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.loki]
}

resource "kubectl_manifest" "vpa_loki_read" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "loki-read"
      namespace = local.namespace
      labels    = module.util_read.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "loki"
          minAllowed = {
            memory = "500Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resource          = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "loki-read"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.loki]
}

resource "kubectl_manifest" "vpa_loki_canary" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "loki-canary"
      namespace = local.namespace
      labels    = module.util_canary.labels
    }
    spec = {
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resource          = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "loki-canary"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.loki]
}
