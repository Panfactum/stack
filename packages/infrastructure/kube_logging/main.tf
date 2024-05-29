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
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
  }
}

data "aws_region" "current" {}

locals {

  name      = "logging"
  namespace = module.namespace.namespace

  default_resources = {
    requests = {
      memory = "100Mi"
    }
    limits = {
      memory = "130Mi"
    }
  }

  loki_read_match = {
    id = random_id.loki_read.hex
  }

  loki_write_match = {
    id = random_id.loki_write.hex
  }

  loki_backend_match = {
    id = random_id.loki_backend.hex
  }
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

resource "random_id" "loki_read" {
  byte_length = 8
  prefix      = "loki-read-"
}

resource "random_id" "loki_write" {
  byte_length = 8
  prefix      = "loki-write-"
}

resource "random_id" "loki_backend" {
  byte_length = 8
  prefix      = "loki-backend-"
}

module "kube_labels_loki_read" {
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

  extra_tags = merge(var.extra_tags, local.loki_read_match)
}

module "kube_labels_loki_write" {
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

  extra_tags = merge(var.extra_tags, local.loki_write_match)
}

module "kube_labels_loki_backend" {
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

  extra_tags = merge(var.extra_tags, local.loki_backend_match)
}

module "constants_loki_read" {
  source = "../constants"

  matching_labels = local.loki_read_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.loki_read_match)
}

module "constants_loki_write" {
  source = "../constants"

  matching_labels = local.loki_write_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.loki_write_match)
}

module "constants_loki_backend" {
  source = "../constants"

  matching_labels = local.loki_backend_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.loki_backend_match)
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

  # generate: pass_common_vars.snippet.txt
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
* Cache
***************************************/

module "redis_cache" {
  source = "../kube_redis_sentinel"

  namespace                   = local.namespace
  replica_count               = 3
  lfu_cache_enabled           = true
  burstable_instances_enabled = true
  persistence_enabled         = false
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  vpa_enabled                 = var.vpa_enabled
  minimum_memory_mb           = 50
  monitoring_enabled          = var.monitoring_enabled

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

resource "kubernetes_secret" "redis_creds" {
  metadata {
    name      = "redis-creds"
    namespace = local.namespace
  }
  data = {
    password = module.redis_cache.superuser_password
  }
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

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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
    labels    = module.kube_labels_loki_backend.kube_labels
  }
}

module "loki_aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.loki.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.loki.json
  ip_allow_list             = var.aws_iam_ip_allow_list

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

resource "helm_release" "loki" {
  namespace       = local.namespace
  name            = "loki"
  repository      = "https://grafana.github.io/helm-charts"
  chart           = "loki"
  version         = var.loki_chart_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5
  timeout         = 60 * 8

  values = [
    yamlencode({
      fullnameOverride = "loki"
      global = {
        image = {
          registry = var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"
        }
      }
      deploymentMode = "SimpleScalable"
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
            tail_proxy_url            = "http://loki-read.${local.namespace}.svc.cluster.local:3100"
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
                username   = module.redis_cache.superuser_name
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
                  username   = module.redis_cache.superuser_name
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
                  username   = module.redis_cache.superuser_name
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
                  username   = module.redis_cache.superuser_name
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
                  username   = module.redis_cache.superuser_name
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
                  username   = module.redis_cache.superuser_name
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
                  username   = module.redis_cache.superuser_name
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
                username   = module.redis_cache.superuser_name
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
        replicas      = 3
        podLabels     = module.kube_labels_loki_backend.kube_labels
        serviceLabels = module.kube_labels_loki_backend.kube_labels
        extraArgs = [
          "-config.expand-env=true",
          "--log.level=${var.log_level}",
          "--log.format=json"
        ]
        extraEnv = [
          {
            name = "REDIS_PASSWORD"
            valueFrom = {
              secretKeyRef = {
                name = kubernetes_secret.redis_creds.metadata[0].name
                key  = "password"
              }
            }
          }
        ]
        priorityClassName             = module.constants_loki_backend.cluster_important_priority_class_name
        topologySpreadConstraints     = module.constants_loki_backend.topology_spread_zone_preferred
        affinity                      = module.constants_loki_backend.pod_anti_affinity_instance_type_helm
        tolerations                   = module.constants_loki_backend.burstable_node_toleration_helm
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
        replicas      = 3
        podLabels     = module.kube_labels_loki_read.kube_labels
        serviceLabels = module.kube_labels_loki_read.kube_labels
        extraArgs = [
          "-config.expand-env=true",
          "--log.level=${var.log_level}",
          "--log.format=json"
        ]
        extraEnv = [
          {
            name = "REDIS_PASSWORD"
            valueFrom = {
              secretKeyRef = {
                name = kubernetes_secret.redis_creds.metadata[0].name
                key  = "password"
              }
            }
          }
        ]
        priorityClassName             = module.constants_loki_read.cluster_important_priority_class_name
        topologySpreadConstraints     = module.constants_loki_read.topology_spread_zone_preferred
        affinity                      = module.constants_loki_read.pod_anti_affinity_instance_type_helm
        tolerations                   = module.constants_loki_read.burstable_node_toleration_helm
        terminationGracePeriodSeconds = 60
        resources                     = local.default_resources
      }

      write = {
        replicas      = 3
        podLabels     = module.kube_labels_loki_write.kube_labels
        serviceLabels = module.kube_labels_loki_write.kube_labels
        extraArgs = [
          "-config.expand-env=true",
          "--log.level=${var.log_level}",
          "--log.format=json"
        ]
        extraEnv = [
          {
            name = "REDIS_PASSWORD"
            valueFrom = {
              secretKeyRef = {
                name = kubernetes_secret.redis_creds.metadata[0].name
                key  = "password"
              }
            }
          }
        ]
        priorityClassName             = module.constants_loki_write.cluster_important_priority_class_name
        topologySpreadConstraints     = module.constants_loki_write.topology_spread_zone_strict
        affinity                      = module.constants_loki_write.pod_anti_affinity_instance_type_helm
        tolerations                   = module.constants_loki_write.burstable_node_toleration_helm
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
    })
  ]

  depends_on = [module.redis_cache]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "loki-dashboard"
    labels = merge(module.kube_labels_loki_backend.kube_labels, { "grafana_dashboard" = "1" })
  }
  data = {
    "loki-metrics.json" = file("${path.module}/dashboards/loki_metrics.json")
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

resource "kubernetes_manifest" "vpa_loki_write" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "loki-write"
      namespace = local.namespace
      labels    = module.kube_labels_loki_write.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "loki-write"
      }
    }
  }
  depends_on = [helm_release.loki]
}

resource "kubernetes_manifest" "vpa_loki_backend" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "loki-backend"
      namespace = local.namespace
      labels    = module.kube_labels_loki_backend.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "loki-backend"
      }
    }
  }
  depends_on = [helm_release.loki]
}

resource "kubernetes_manifest" "vpa_loki_read" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "loki-read"
      namespace = local.namespace
      labels    = module.kube_labels_loki_read.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "loki-read"
      }
    }
  }
  depends_on = [helm_release.loki]
}
