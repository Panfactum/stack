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
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
  }
}

data "aws_region" "current" {}

locals {

  name      = "monitoring"
  namespace = module.namespace.namespace

  default_tracked_labels = [
    # Panfactum labels
    "panfactum.com/environment",
    "panfactum.com/module",
    "panfactum.com/region",
    "panfactum.com/root-module",
    "panfactum.com/stack-commit",
    "panfactum.com/stack-version"
  ]

  # Required for VPA to work
  extra_pod_labels = [
    "app.kubernetes.io/instance",
    "app.kubernetes.io/name",
    "app.kubernetes.io/managed-by",
    "app.kubernetes.io/component",
    "pod-template-id",
    "k8s-app",
    "id",
    "linkerd.io/control-plane-component",
    "linkerd.io/control-plane-ns",
    "linkerd.io/proxy-deployment",
    "app",
    "release",
    "name",
    "io.cilium/app"
  ]
  labels_to_track     = tolist(toset(concat(local.default_tracked_labels, var.additional_tracked_resource_labels)))
  pod_labels_to_track = tolist(toset(concat(local.extra_pod_labels, local.labels_to_track)))

  default_tracked_resources = [
    "certificatesigningrequests",
    "configmaps",
    "cronjobs",
    "daemonsets",
    "deployments",
    "endpoints",
    "horizontalpodautoscalers",
    "ingresses",
    "jobs",
    "leases",
    "limitranges",
    "mutatingwebhookconfigurations",
    "namespaces",
    "networkpolicies",
    "nodes",
    "persistentvolumeclaims",
    "persistentvolumes",
    "poddisruptionbudgets",
    "pods",
    "replicasets",
    "resourcequotas",
    "secrets",
    "services",
    "statefulsets",
    "storageclasses",
    "validatingwebhookconfigurations"
  ]
  resources_to_track = tolist(toset(concat(local.default_tracked_resources, var.additional_tracked_resources)))

  default_resources = {
    requests = {
      memory = "100Mi"
    }
    limits = {
      memory = "130Mi"
    }
  }

  default_image = {
    registry = var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"
  }

  default_docker_image = {
    registry = var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"
  }

  default_k8s_image = {
    registry = var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"
  }

  operator_webhook_match = {
    id = random_id.operator_webhook.hex
  }

  operator_match = {
    id = random_id.operator.hex
  }

  grafana_match = {
    id = random_id.grafana.hex
  }

  node_exporter_match = {
    id = random_id.node_exporter.hex
  }

  kube_state_metrics_match = {
    id = random_id.kube_state_metrics.hex
  }

  prometheus_match = {
    id = random_id.prometheus.hex
  }

  thanos_compactor_match = {
    id = random_id.thanos_compactor.hex
  }

  thanos_store_gateway_match = {
    id = random_id.thanos_store_gateway.hex
  }

  thanos_query_match = {
    id = random_id.thanos_query.hex
  }

  thanos_ruler_match = {
    id = random_id.thanos_ruler.hex
  }

  thanos_bucket_web_match = {
    id = random_id.thanos_bucket_web.hex
  }

  thanos_query_frontend_match = {
    id = random_id.thanos_query_frontend.hex
  }

  alertmanager_match = {
    id = random_id.alertmanager.hex
  }

  thanos_store_gateway_index_config = {
    type = "REDIS"
    config = {
      addr     = "${module.thanos_redis_cache.redis_master_host}:${module.thanos_redis_cache.redis_port}"
      username = module.thanos_redis_cache.superuser_name
      password = "$(REDIS_PASSWORD)"
      # Sentinel cannot be used due to this issue: https://github.com/thanos-io/thanos/issues/6246
      # master_name = module.thanos_redis_cache.master_set
      cache_size = "50MB"
      db         = 0
      ttl        = "24h"
    }
  }

  thanos_store_gateway_caching_bucket_config = {
    type = "REDIS"
    config = {
      addr     = "${module.thanos_redis_cache.redis_master_host}:${module.thanos_redis_cache.redis_port}"
      username = module.thanos_redis_cache.superuser_name
      password = "$(REDIS_PASSWORD)"
      # Sentinel cannot be used due to this issue: https://github.com/thanos-io/thanos/issues/6246
      # master_name = module.thanos_redis_cache.master_set
      cache_size = "256MB"
      db         = 1
    }
  }

  thanos_query_frontend_caching_config = {
    type = "REDIS"
    config = {
      addr     = "${module.thanos_redis_cache.redis_master_host}:${module.thanos_redis_cache.redis_port}"
      username = module.thanos_redis_cache.superuser_name
      password = "$(REDIS_PASSWORD)"
      # Sentinel cannot be used due to this issue: https://github.com/thanos-io/thanos/issues/6246
      # master_name = module.thanos_redis_cache.master_set
      cache_size = "256MB"
      db         = 2
    }
  }

}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

resource "random_id" "operator_webhook" {
  byte_length = 8
  prefix      = "prometheus-operator-webhook-"
}

resource "random_id" "operator" {
  byte_length = 8
  prefix      = "prometheus-operator-"
}

resource "random_id" "grafana" {
  byte_length = 8
  prefix      = "grafana-"
}

resource "random_id" "node_exporter" {
  byte_length = 8
  prefix      = "node-exporter-"
}

resource "random_id" "kube_state_metrics" {
  byte_length = 8
  prefix      = "kube-state-metrics-"
}

resource "random_id" "prometheus" {
  byte_length = 8
  prefix      = "prometheus-"
}

resource "random_id" "thanos_compactor" {
  byte_length = 8
  prefix      = "thanos-compactor-"
}

resource "random_id" "thanos_store_gateway" {
  byte_length = 8
  prefix      = "thanos-store-gateway-"
}

resource "random_id" "thanos_ruler" {
  byte_length = 8
  prefix      = "thanos-ruler-"
}

resource "random_id" "thanos_query" {
  byte_length = 8
  prefix      = "thanos-query-"
}

resource "random_id" "thanos_query_frontend" {
  byte_length = 8
  prefix      = "thanos-query-frontend-"
}

resource "random_id" "thanos_bucket_web" {
  byte_length = 8
  prefix      = "thanos-bucket-web-"
}

resource "random_id" "alertmanager" {
  byte_length = 8
  prefix      = "alertmanager-"
}

module "kube_labels_operator" {
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

  extra_tags = merge(var.extra_tags, local.operator_match)
}

module "kube_labels_operator_webhook" {
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

  extra_tags = merge(var.extra_tags, local.operator_webhook_match)
}

module "kube_labels_grafana" {
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

  extra_tags = merge(var.extra_tags, local.grafana_match)
}

module "kube_labels_node_exporter" {
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

  extra_tags = merge(var.extra_tags, local.node_exporter_match)
}

module "kube_labels_kube_state_metrics" {
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

  extra_tags = merge(var.extra_tags, local.kube_state_metrics_match)
}

module "kube_labels_prometheus" {
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

  extra_tags = merge(var.extra_tags, local.prometheus_match)
}

module "kube_labels_thanos_compactor" {
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

  extra_tags = merge(var.extra_tags, local.thanos_compactor_match)
}

module "kube_labels_thanos_store_gateway" {
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

  extra_tags = merge(var.extra_tags, local.thanos_store_gateway_match)
}

module "kube_labels_thanos_query" {
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

  extra_tags = merge(var.extra_tags, local.thanos_query_match)
}

module "kube_labels_thanos_ruler" {
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

  extra_tags = merge(var.extra_tags, local.thanos_ruler_match)
}

module "kube_labels_thanos_bucket_web" {
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

  extra_tags = merge(var.extra_tags, local.thanos_bucket_web_match)
}

module "kube_labels_thanos_query_frontend" {
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

  extra_tags = merge(var.extra_tags, local.thanos_query_frontend_match)
}

module "kube_labels_alertmanager" {
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

  extra_tags = merge(var.extra_tags, local.alertmanager_match)
}

module "constants_operator" {
  source = "../constants"

  matching_labels = local.operator_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.operator_match)
}

module "constants_operator_webhook" {
  source = "../constants"

  matching_labels = local.operator_webhook_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.operator_webhook_match)
}

module "constants_grafana" {
  source = "../constants"

  matching_labels = local.grafana_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.grafana_match)
}

module "constants_node_exporter" {
  source = "../constants"

  matching_labels = local.node_exporter_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.node_exporter_match)
}

module "constants_kube_state_metrics" {
  source = "../constants"

  matching_labels = local.kube_state_metrics_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.kube_state_metrics_match)
}

module "constants_prometheus" {
  source = "../constants"

  matching_labels = local.prometheus_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.prometheus_match)
}

module "constants_thanos_compactor" {
  source = "../constants"

  matching_labels = local.thanos_compactor_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.thanos_compactor_match)
}

module "constants_thanos_store_gateway" {
  source = "../constants"

  matching_labels = local.thanos_store_gateway_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.thanos_store_gateway_match)
}

module "constants_thanos_query" {
  source = "../constants"

  matching_labels = local.thanos_query_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.thanos_query_match)
}

module "constants_thanos_ruler" {
  source = "../constants"

  matching_labels = local.thanos_ruler_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.thanos_ruler_match)
}

module "constants_thanos_bucket_web" {
  source = "../constants"

  matching_labels = local.thanos_ruler_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.thanos_bucket_web_match)
}

module "constants_thanos_query_frontend" {
  source = "../constants"

  matching_labels = local.thanos_query_frontend_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.thanos_query_frontend_match)
}

module "constants_alertmanager" {
  source = "../constants"

  matching_labels = local.alertmanager_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.alertmanager_match)
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
* Grafana Database
***************************************/

module "grafana_db" {
  source = "../kube_pg_cluster"

  eks_cluster_name            = var.eks_cluster_name
  pg_cluster_namespace        = local.namespace
  pg_storage_gb               = 1
  pg_memory_mb                = 500
  pg_cpu_millicores           = 250
  pg_instances                = 2
  pg_shutdown_timeout         = 30
  aws_iam_ip_allow_list       = var.aws_iam_ip_allow_list
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  pgbouncer_pool_mode         = "session"
  burstable_instances_enabled = true
  backups_enabled             = false
  backups_force_delete        = true

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
* Thanos Cache
***************************************/

module "thanos_redis_cache" {
  source = "../kube_redis_sentinel"

  namespace                   = local.namespace
  replica_count               = 3
  lfu_cache_enabled           = true
  burstable_instances_enabled = true
  persistence_enabled         = false
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  vpa_enabled                 = var.vpa_enabled
  minimum_memory_mb           = 100

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
    password = module.thanos_redis_cache.superuser_password
  }
}

/***************************************
* Metrics Storage
***************************************/
resource "random_id" "metrics_bucket_name" {
  byte_length = 8
  prefix      = "prometheus-"
}

module "metrics_bucket" {
  source      = "../aws_s3_private_bucket"
  bucket_name = random_id.metrics_bucket_name.hex
  description = "Long term metrics storage"

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

data "aws_iam_policy_document" "prometheus" {
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject"
    ]
    resources = ["${module.metrics_bucket.bucket_arn}/*"]
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket"
    ]
    resources = [module.metrics_bucket.bucket_arn]
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
* Prometheus Stack
***************************************/

resource "time_rotating" "grafana_admin_pw" {
  rotation_days = 7
}

resource "random_password" "grafana_admin_pw" {
  length  = 32
  special = false
  keepers = {
    time = time_rotating.grafana_admin_pw.id
  }
}

resource "kubernetes_service_account" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = local.namespace
    labels    = module.kube_labels_prometheus.kube_labels
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.prometheus.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.prometheus.json
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

resource "kubernetes_secret" "grafana_creds" {
  metadata {
    name      = "grafana-creds"
    namespace = local.namespace
  }
  data = {
    admin-user        = "admin"
    admin-password    = random_password.grafana_admin_pw.result
    database-password = module.grafana_db.superuser_password
  }
}

resource "helm_release" "prometheus_stack" {
  namespace       = local.namespace
  name            = "prometheus"
  repository      = "https://prometheus-community.github.io/helm-charts"
  chart           = "kube-prometheus-stack"
  version         = var.kube_prometheus_stack_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      fullnameOverride                   = "monitoring"
      cleanPrometheusOperatorObjectNames = true
      labels                             = module.kube_labels_prometheus.kube_labels
      commonLabels = {
        customizationHash = md5(join("", [for filename in fileset(path.module, "prometheus_kustomize/*") : filesha256(filename)]))
      }

      crds = {
        enabled = true
      }

      defaultRules = {
        create = true
        rules = {
          etcd                   = var.monitoring_etcd_enabled
          kubeSchedulerAlerting  = false // Not exposed in EKS
          kubeSchedulerRecording = false // Not exposed in EKS
          kubernetesSystem       = false // Not exposed in EKS
          kubeControllerManager  = false // Not exposed in EKS
          kubeProxy              = false // We do not use kube-proxy
        }
      }

      //////////////////////////////////////////////////////////
      // Prometheus Operator
      //////////////////////////////////////////////////////////
      prometheusOperator = {
        enabled          = true
        fullnameOverride = "prometheus-operator"
        labels           = module.kube_labels_operator.kube_labels
        podLabels        = module.kube_labels_operator.kube_labels
        image            = local.default_image
        strategy = {
          type          = "Recreate"
          rollingUpdate = null
        }

        logFormat = "json"
        logLevel  = var.prometheus_operator_log_level

        priorityClassName = module.constants_operator.cluster_important_priority_class_name
        tolerations       = module.constants_operator.burstable_node_toleration_helm
        service = {
          labels = module.kube_labels_operator.kube_labels
        }
        resources = local.default_resources
        admissionWebhooks = {
          deployment = {
            enabled     = true
            image       = local.default_image
            labels      = module.kube_labels_operator_webhook.kube_labels
            podLabels   = module.kube_labels_operator_webhook.kube_labels
            replicas    = 2
            tolerations = module.constants_operator_webhook.burstable_node_toleration_helm
            affinity    = module.constants_operator_webhook.pod_anti_affinity_instance_type_helm
            service = {
              labels = module.kube_labels_operator_webhook.kube_labels
            }
            resources = local.default_resources
          }
          patch = {
            enabled = false
          }
          certManager = {
            enabled = true
            admissionCert = {
              duration = "336h0m0s"
            }
            issuerRef = {
              name = "internal"
              kind = "ClusterIssuer"
            }
          }
        }
        prometheusConfigReloader = {
          image       = local.default_image
          enableProbe = true
          resources   = local.default_resources
        }
        thanosImage = local.default_image
      }

      //////////////////////////////////////////////////////////
      // Prometheus Node exporter sub-chart
      //////////////////////////////////////////////////////////
      prometheus-node-exporter = {
        fullnameOverride  = "node-exporter"
        priorityClassName = "system-node-critical"
        podLabels         = module.kube_labels_node_exporter.kube_labels
        tolerations = concat(
          [
            {
              key      = "node.kubernetes.io/not-ready"
              operator = "Exists"
              effect   = "NoExecute"
            },
            {
              key      = "node.kubernetes.io/unreachable"
              operator = "Exists"
              effect   = "NoExecute"
            },
            {
              key      = "node.kubernetes.io/disk-pressure"
              operator = "Exists"
              effect   = "NoSchedule"
            },
            {
              key      = "node.kubernetes.io/memory-pressure"
              operator = "Exists"
              effect   = "NoSchedule"
            },
            {
              key      = "node.kubernetes.io/pid-pressure"
              operator = "Exists"
              effect   = "NoSchedule"
            }
          ],
          module.constants_node_exporter.burstable_node_toleration_helm
        )
        resources = local.default_resources
      }

      //////////////////////////////////////////////////////////
      // Kube-state-metrics sub-chart
      //////////////////////////////////////////////////////////
      kube-state-metrics = {
        image        = local.default_k8s_image
        customLabels = module.kube_labels_kube_state_metrics.kube_labels
        extraArgs = [
          "--metric-labels-allowlist=pods=[${join(",", local.pod_labels_to_track)}]"
        ]
        updateStrategy = "Recreate"
        tolerations    = module.constants_kube_state_metrics.burstable_node_toleration_helm
        resources = {
          requests = {
            memory = "200Mi"
          }
          limits = {
            memory = "260Mi"
          }
        }

        collectors = local.resources_to_track

        prometheus = {
          monitor = {
            metricRelabelings = concat(
              // Removes the panfactum.com/ prefix
              [for label in [
                "label_panfactum_com_environment",
                "label_panfactum_com_region",
                "label_panfactum_com_stack_version",
                "label_panfactum_com_stack_commit",
                "label_panfactum_com_module",
                "label_panfactum_com_root_module"
                ] : {
                sourceLabels = ["__name__", label],
                regex        = "(.*_labels);(.+)"
                targetLabel  = "label_${trimprefix(label, "label_panfactum_com_")}"
                replacement  = "$2"
                action       = "replace"
                }
              ],
              [
                {
                  regex  = ".*panfactum_com.*"
                  action = "labeldrop"
                },

                // This addresses a bug in a previous version of the stack
                // where the access mode array contained duplicate entries
                // for postgres deployments. This causes duplicate samples
                // to be sent to prometheus which triggers alerts.
                {
                  action       = "drop"
                  regex        = "kube_persistentvolumeclaim_access_mode"
                  sourceLabels = ["__name__"]
                },
              ]
            )
          }
        }
      }

      //////////////////////////////////////////////////////////
      // etcd
      //////////////////////////////////////////////////////////
      kubeEtcd = {
        enabled = var.monitoring_etcd_enabled
      }

      //////////////////////////////////////////////////////////
      // Kubernetes API server monitoring
      //////////////////////////////////////////////////////////
      kubeApiServer = {
        enabled = true
        serviceMonitor = {
          metricRelabelings = [
            {
              action       = "drop"
              regex        = "apiserver_request_duration_seconds_.*" # Use apiserver_request_sli_duration_seconds_ instead
              sourceLabels = ["__name__"]
            },
            # These aren't really important to track and they use a lot of space
            {
              action       = "drop"
              regex        = "apiserver_request_body_size_.*"
              sourceLabels = ["__name__"]
            },
            {
              action       = "drop"
              regex        = "apiserver_response_body_size_.*"
              sourceLabels = ["__name__"]
            },
            {
              action       = "drop"
              regex        = "kubernetes_feature_enabled"
              sourceLabels = ["__name__"]
            }
          ]
        }
      }

      //////////////////////////////////////////////////////////
      // Kubernetes Scheduler
      //////////////////////////////////////////////////////////
      kubeScheduler = {
        enabled = false // not exposed in EKS
      }

      //////////////////////////////////////////////////////////
      // kube-proxy
      //////////////////////////////////////////////////////////
      kubeProxy = {
        enabled = false // we do not use kube-proxy
      }

      //////////////////////////////////////////////////////////
      // Kubernetes Controller Manager
      //////////////////////////////////////////////////////////
      kubeControllerManager = {
        enabled = false // not exposed in EKS
      }

      //////////////////////////////////////////////////////////
      // coreDNS
      //////////////////////////////////////////////////////////
      coreDns = {
        enabled = false // we monitor this in our own module
      }

      //////////////////////////////////////////////////////////
      // Prometheus
      //////////////////////////////////////////////////////////
      prometheus = {
        serviceAccount = {
          create = false
          name   = kubernetes_service_account.prometheus.metadata[0].name
        }
        thanosService = {
          enabled = true
          labels  = module.kube_labels_prometheus.kube_labels
        }
        thanosServiceMonitor = {
          enabled          = true
          additionalLabels = module.kube_labels_prometheus.kube_labels
        }
        prometheusSpec = {
          podMetadata = {
            labels = module.kube_labels_prometheus.kube_labels
          }
          image                     = local.default_image
          replicas                  = 2
          tolerations               = module.constants_prometheus.burstable_node_toleration_helm
          affinity                  = module.constants_prometheus.pod_anti_affinity_instance_type_helm
          topologySpreadConstraints = module.constants_prometheus.topology_spread_zone_strict
          resources = {
            requests = {
              memory = "1000Mi"
            }
            limits = {
              memory = "1300Mi"
            }
          }

          logLevel          = var.prometheus_log_level
          logFormat         = "json"
          scrapeInterval    = "${var.prometheus_default_scrape_interval_seconds}s"
          retention         = "1h" // This is only for local retention (before data is shipped to s3 by thanos)
          disableCompaction = true

          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                storageClassName = var.prometheus_storage_class_name
                resources = {
                  requests = {
                    storage = "${var.prometheus_local_storage_initial_size_gb}Gi"
                  }
                }
              }
            }
          }
          persistentVolumeClaimRetentionPolicy = {
            whenDeleted = "Delete"
            whenScaled  = "Delete"
          }
          thanos = {
            image     = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/thanos/thanos:${var.thanos_image_version}"
            logLevel  = var.prometheus_log_level
            logFormat = "json"
            resources = local.default_resources
            blockSize = "30m"
            objectStorageConfig = {
              secret = {
                type = "s3"
                config = {
                  bucket       = module.metrics_bucket.bucket_name
                  endpoint     = "s3.${data.aws_region.current.name}.amazonaws.com"
                  aws_sdk_auth = true
                }
              }
            }
          }
        }
      }

      //////////////////////////////////////////////////////////
      // Alert Manager
      //////////////////////////////////////////////////////////
      alertmanager = {
        enabled = true
        service = {
          labels = module.kube_labels_alertmanager.kube_labels
        }
        alertmanagerSpec = {
          podMetadata = {
            labels = module.kube_labels_alertmanager.kube_labels
          }
          image     = local.default_image
          logLevel  = var.alertmanager_log_level
          logFormat = "json"

          storage = {
            volumeClaimTemplate = {
              spec = {
                storageClassName = var.alertmanager_storage_class_name
                resources = {
                  requests = {
                    storage = "${var.alertmanager_local_storage_initial_size_gb}Gi"
                  }
                }
                annotations = {
                  "velero.io/exclude-from-backup" = "true"
                }
              }
            }
          }

          replicas                  = 2
          resources                 = local.default_resources
          affinity                  = module.constants_alertmanager.pod_anti_affinity_instance_type_helm
          tolerations               = module.constants_alertmanager.burstable_node_toleration_helm
          topologySpreadConstraints = module.constants_alertmanager.topology_spread_zone_strict
          priorityClassName         = module.constants_alertmanager.cluster_important_priority_class_name
        }
      }

      //////////////////////////////////////////////////////////
      // Grafana
      //////////////////////////////////////////////////////////
      grafana = {
        enabled = true
        global = {
          image = local.default_docker_image
        }
        extraLabels = module.kube_labels_grafana.kube_labels
        podLabels   = module.kube_labels_grafana.kube_labels
        annotations = {
          "reloader.stakater.com/auto" = "true"
        }

        admin = {
          existingSecret = kubernetes_secret.grafana_creds.metadata[0].name
          userKey        = "admin-user"
          passwordKey    = "admin-password"
        }
        envValueFrom = {
          GF_DATABASE_PASSWORD = {
            secretKeyRef = {
              name = kubernetes_secret.grafana_creds.metadata[0].name
              key  = "database-password"
            }
          }
        }
        "grafana.ini" = {
          server = {
            domain   = var.grafana_domain
            root_url = "https://${var.grafana_domain}/"
          }

          database = {
            type          = "postgres"
            host          = "${module.grafana_db.pooler_rw_service_name}:${module.grafana_db.pooler_rw_service_port}"
            name          = "app"
            user          = module.grafana_db.superuser_username
            password      = "default"
            max_open_conn = 100
            max_idle_conn = 100
            ssl_mode      = "require"
          }

          users = {
            viewers_can_edit  = true
            editors_can_admin = true
            hidden_users      = "admin"
            home_page         = "https://${var.grafana_domain}/dashboards/"
          }

          log = {
            mode  = "console"
            level = var.grafana_log_level
          }

          "log.console" = {
            format = "json"
          }

          security = {
            # From https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-security-hardening
            cookie_secure                    = true
            cookie_samesite                  = "strict"
            login_cookie_name                = "__Host-grafana_session"
            content_security_policy          = true
            content_security_policy_template = "\"\"\"script-src 'self' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic' $NONCE;object-src 'none';font-src 'self';style-src 'self' 'unsafe-inline' blob:;img-src * data:;base-uri 'self';connect-src 'self' grafana.com ws://$ROOT_PATH wss://$ROOT_PATH;manifest-src 'self';media-src 'none';form-action 'self';\"\"\""
            hide_version                     = true
          }

          auth = {
            disable_login_form = !var.grafana_basic_auth_enabled
          }

          "auth.basic" = {
            enabled = var.grafana_basic_auth_enabled
          }

          "auth.generic_oauth" = {
            enabled                    = true
            name                       = "Vault"
            client_id                  = vault_identity_oidc_client.oidc.client_id
            client_secret              = vault_identity_oidc_client.oidc.client_secret
            auth_url                   = "https://${var.vault_domain}/ui/vault/identity/oidc/provider/grafana/authorize"
            api_url                    = "${vault_identity_oidc_provider.oidc.issuer}/userinfo"
            token_url                  = "${vault_identity_oidc_provider.oidc.issuer}/token"
            scopes                     = "openid profile"
            role_attribute_path        = "contains(groups[*], 'rbac-superusers') && 'Admin' || contains(groups[*], 'rbac-admins') && 'Editor' || 'Viewer'"
            email_attribute_path       = "email"
            name_attribute_path        = "name"
            allow_assign_grafana_admin = true
            auto_login                 = !var.grafana_basic_auth_enabled
            use_pkce                   = true
          }
        }

        replicas = 2
        deploymentStrategy = {
          type          = "Recreate"
          rollingUpdate = null
        }
        tolerations               = module.constants_grafana.burstable_node_toleration_helm
        affinity                  = module.constants_grafana.pod_anti_affinity_instance_type_helm
        topologySpreadConstraints = module.constants_grafana.topology_spread_zone_preferred

        resources = local.default_resources

        ingress = {
          enabled = false // We use our custom ingress below
        }
        assertNoLeakedSecrets = false
      }

    })
  ]

  postrender {
    binary_path = "${path.module}/prometheus_kustomize/kustomize.sh"
  }

  depends_on = [module.grafana_db]
}

/***************************************
* Vault IdP Setup
***************************************/

resource "vault_identity_oidc_key" "oidc" {
  name               = "grafana"
  allowed_client_ids = ["*"]
  rotation_period    = 60 * 60 * 8
  verification_ttl   = 60 * 60 * 24
}

data "vault_identity_group" "rbac_groups" {
  for_each   = toset(["rbac-superusers", "rbac-admins", "rbac-readers"])
  group_name = each.key
}

resource "vault_identity_oidc_assignment" "oidc" {
  name      = "grafana"
  group_ids = [for group in data.vault_identity_group.rbac_groups : group.id]
}

resource "vault_identity_oidc_client" "oidc" {
  name = "grafana"
  key  = vault_identity_oidc_key.oidc.name
  redirect_uris = [
    "https://${var.grafana_domain}/login/generic_oauth",
  ]
  assignments = [
    vault_identity_oidc_assignment.oidc.name
  ]
  id_token_ttl     = 60 * 60 * 8
  access_token_ttl = 60 * 60 * 8
}

resource "vault_identity_oidc_provider" "oidc" {
  name = "grafana"

  https_enabled = true
  issuer_host   = var.vault_domain
  allowed_client_ids = [
    vault_identity_oidc_client.oidc.client_id
  ]
  scopes_supported = [
    "profile"
  ]
}


/***************************************
* Thanos
***************************************/


resource "kubernetes_service_account" "thanos_compactor" {
  metadata {
    name      = "thanos-compactor"
    namespace = local.namespace
    labels    = module.kube_labels_thanos_compactor.kube_labels
  }
}

module "aws_permissions_thanos_compactor" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.thanos_compactor.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.prometheus.json
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

resource "kubernetes_service_account" "thanos_store_gateway" {
  metadata {
    name      = "thanos-store-gateway"
    namespace = local.namespace
    labels    = module.kube_labels_thanos_store_gateway.kube_labels
  }
}

module "aws_permissions_thanos_store_gateway" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.thanos_store_gateway.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.prometheus.json
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

resource "kubernetes_service_account" "thanos_ruler" {
  metadata {
    name      = "thanos-ruler"
    namespace = local.namespace
    labels    = module.kube_labels_thanos_ruler.kube_labels
  }
}

module "aws_permissions_thanos_ruler" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.thanos_ruler.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.prometheus.json
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

resource "kubernetes_service_account" "thanos_bucket_web" {
  metadata {
    name      = "thanos-bucket-web"
    namespace = local.namespace
    labels    = module.kube_labels_thanos_bucket_web.kube_labels
  }
}

module "aws_permissions_thanos_bucket_web" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.thanos_bucket_web.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.prometheus.json
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



resource "helm_release" "thanos" {
  namespace       = local.namespace
  name            = "thanos"
  repository      = "oci://registry-1.docker.io/bitnamicharts"
  chart           = "thanos"
  version         = var.thanos_chart_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      fullnameOverride = "thanos"
      global = {
        imageRegistry = var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"
      }
      query = {
        enabled = true

        logLevel  = var.thanos_log_level
        logFormat = "json"
        dnsDiscovery = {
          sidecarsService   = "monitoring-thanos-discovery"
          sidecarsNamespace = local.namespace
        }
        replicaLabel = ["prometheus_replica"]
        extraFlags = [
          "--enable-auto-gomemlimit"
        ]

        podLabels = module.kube_labels_thanos_query.kube_labels
        service = {
          labels = module.kube_labels_thanos_query.kube_labels
        }
        replicaCount              = 2
        priorityClassName         = module.constants_thanos_query.cluster_important_priority_class_name
        topologySpreadConstraints = module.constants_thanos_query.topology_spread_zone_strict
        affinity                  = module.constants_thanos_query.pod_anti_affinity_instance_type_helm
        tolerations               = module.constants_thanos_query.burstable_node_toleration_helm
        resources                 = local.default_resources
      }
      queryFrontend = {
        enabled = true

        logLevel  = var.thanos_log_level
        logFormat = "json"
        extraFlags = [
          "--query-range.response-cache-config=${yamlencode(local.thanos_query_frontend_caching_config)}",
          "--cache-compression-type=snappy",
          "--enable-auto-gomemlimit"
        ]
        extraEnvVars = [
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

        podLabels = module.kube_labels_thanos_query_frontend.kube_labels
        service = {
          labels = module.kube_labels_thanos_query_frontend.kube_labels
        }
        replicaCount              = 2
        priorityClassName         = module.constants_thanos_query_frontend.cluster_important_priority_class_name
        topologySpreadConstraints = module.constants_thanos_query_frontend.topology_spread_zone_strict
        affinity                  = module.constants_thanos_query_frontend.pod_anti_affinity_instance_type_helm
        tolerations               = module.constants_thanos_query_frontend.burstable_node_toleration_helm
        resources                 = local.default_resources
      }

      bucketweb = {
        enabled = var.thanos_bucket_web_enable

        logLevel  = var.thanos_log_level
        logFormat = "json"

        serviceAccount = {
          create = false
          name   = kubernetes_service_account.thanos_bucket_web.metadata[0].name
        }
        service = {
          labels = module.kube_labels_thanos_bucket_web.kube_labels
        }
        updateStrategy = {
          type = "Recreate"
        }
        podLabels   = module.kube_labels_thanos_bucket_web.kube_labels
        tolerations = module.constants_thanos_bucket_web.burstable_node_toleration_helm
        resources   = local.default_resources
      }
      compactor = {
        enabled = true

        logLevel               = var.thanos_log_level
        logFormat              = "json"
        retentionResolutionRaw = "${var.metrics_retention_resolution_raw}d"
        retentionResolution5m  = "${var.metrics_retention_resolution_5m}d"
        retentionResolution1h  = "${var.metrics_retention_resolution_1h}d"
        extraFlags = [
          // See https://thanos.io/tip/components/compact.md/#vertical-compactions
          "--compact.enable-vertical-compaction",
          "--deduplication.replica-label=prometheus_replica",
          "--deduplication.func=penalty",

          // See https://thanos.io/tip/components/compact.md/#deleting-aborted-partial-uploads
          "--delete-delay=12h",

          "--enable-auto-gomemlimit"
        ]

        podLabels = module.kube_labels_thanos_compactor.kube_labels
        cronJob = {
          enabled                    = true
          ttlSecondsAfterFinished    = 60 * 3
          failedJobsHistoryLimit     = 0
          successfulJobsHistoryLimit = 0
        }
        persistence = {
          enabled      = true
          ephemeral    = true
          size         = "${var.thanos_compactor_disk_storage_gb}Gi"
          storageClass = var.thanos_compactor_storage_class_name
          annotations = {
            "velero.io/exclude-from-backup" = "true"
          }
        }
        serviceAccount = {
          create = false
          name   = kubernetes_service_account.thanos_compactor.metadata[0].name
        }
        tolerations       = module.constants_thanos_compactor.burstable_node_toleration_helm
        priorityClassName = module.constants_thanos_store_gateway.cluster_important_priority_class_name
        resources = {
          requests = {
            cpu    = "200m"
            memory = "200Mi"
          }
          limits = {
            memory = "260Mi"
          }
        }
      }
      storegateway = {
        enabled   = true
        logLevel  = var.thanos_log_level
        logFormat = "json"
        extraEnvVars = [
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
        extraFlags = [
          "--index-cache.config=${yamlencode(local.thanos_store_gateway_index_config)}",
          "--store.caching-bucket.config=${yamlencode(local.thanos_store_gateway_caching_bucket_config)}",
          "--enable-auto-gomemlimit"
        ]
        serviceAccount = {
          create = false
          name   = kubernetes_service_account.thanos_store_gateway.metadata[0].name
        }
        service = {
          labels = module.kube_labels_thanos_store_gateway.kube_labels
        }
        persistence = {
          enabled      = true
          storageClass = var.thanos_store_gateway_storage_class_name
          annotations = {
            "velero.io/exclude-from-backup" = "true"
          }
        }
        podLabels                 = module.kube_labels_thanos_store_gateway.kube_labels
        replicaCount              = 2
        priorityClassName         = module.constants_thanos_store_gateway.cluster_important_priority_class_name
        topologySpreadConstraints = module.constants_thanos_store_gateway.topology_spread_zone_strict
        affinity                  = module.constants_thanos_store_gateway.pod_anti_affinity_instance_type_helm
        tolerations               = module.constants_thanos_store_gateway.burstable_node_toleration_helm
        resources                 = local.default_resources
      }
      ruler = {
        enabled = true
        serviceAccount = {
          create = false
          name   = kubernetes_service_account.thanos_store_gateway.metadata[0].name
        }
        tolerations = module.constants_thanos_ruler.burstable_node_toleration_helm
        alertmanagers = [
          "http://monitoring-alertmanager.${local.namespace}.svc.cluster.local:9093"
        ]
        config = yamlencode({
          groups = [{
            name = "metamonitoring"
            rules = [{
              alert = "PrometheusDown"
              expr  = "absent(up{prometheus=\"monitoring/monitoring\"})"
            }]
          }]
        })
      }
      metrics = {
        enabled = true
        serviceMonitor = {
          enabled = true
        }
      }
      objstoreConfig = yamlencode(
        {
          type = "s3"
          config = {
            bucket       = module.metrics_bucket.bucket_name
            endpoint     = "s3.${data.aws_region.current.name}.amazonaws.com"
            aws_sdk_auth = true
          }
        }
      )
    })
  ]

  depends_on = [helm_release.prometheus_stack, module.thanos_redis_cache]
}


/***************************************
* PDBs
***************************************/

resource "kubernetes_manifest" "pdb_prometheus_operator" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "prometheus-operator"
      namespace = local.namespace
      labels    = module.kube_labels_operator.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.operator_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "pdb_prometheus_operator_webhook" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "prometheus-operator-webhook"
      namespace = local.namespace
      labels    = module.kube_labels_operator_webhook.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.operator_webhook_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "pdb_grafana" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "prometheus-grafana"
      namespace = local.namespace
      labels    = module.kube_labels_grafana.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.grafana_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "pdb_kube_state_metrics" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "prometheus-kube-state-metrics"
      namespace = local.namespace
      labels    = module.kube_labels_kube_state_metrics.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.kube_state_metrics_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "pdb_prometheus" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "prometheus"
      namespace = local.namespace
      labels    = module.kube_labels_prometheus.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.prometheus_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "pdb_thanos_compactor" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "thanos-compactor"
      namespace = local.namespace
      labels    = module.kube_labels_thanos_compactor.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.thanos_compactor_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.thanos]
}

resource "kubernetes_manifest" "pdb_thanos_bucket_web" {
  count = var.thanos_bucket_web_enable ? 1 : 0
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "thanos-bucket-web"
      namespace = local.namespace
      labels    = module.kube_labels_thanos_bucket_web.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.thanos_bucket_web_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.thanos]
}

resource "kubernetes_manifest" "pdb_thanos_store_gateway" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "thanos-store-gateway"
      namespace = local.namespace
      labels    = module.kube_labels_thanos_store_gateway.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.thanos_store_gateway_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.thanos]
}

resource "kubernetes_manifest" "pdb_thanos_query_frontend" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "thanos-query-frontend"
      namespace = local.namespace
      labels    = module.kube_labels_thanos_query_frontend.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.thanos_query_frontend_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.thanos]
}

resource "kubernetes_manifest" "pdb_thanos_query" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "thanos-query"
      namespace = local.namespace
      labels    = module.kube_labels_thanos_query.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.thanos_query_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.thanos]
}

resource "kubernetes_manifest" "alertmanager" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "alertmanager"
      namespace = local.namespace
      labels    = module.kube_labels_alertmanager.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.alertmanager_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

/***************************************
* Autoscaling
***************************************/

resource "kubernetes_manifest" "vpa_prometheus_operator" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus-operator"
      namespace = local.namespace
      labels    = module.kube_labels_operator.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "prometheus-operator"
      }
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "vpa_prometheus_operator_webhook" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus-operator-webhook"
      namespace = local.namespace
      labels    = module.kube_labels_operator_webhook.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "prometheus-operator-webhook"
      }
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "vpa_grafana" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus-grafana"
      namespace = local.namespace
      labels    = module.kube_labels_grafana.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "prometheus-grafana"
      }
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "vpa_node_exporter" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus-node-exporter"
      namespace = local.namespace
      labels    = module.kube_labels_node_exporter.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "node-exporter"
      }
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "vpa_kube_state_metrics" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus-kube-state-metrics"
      namespace = local.namespace
      labels    = module.kube_labels_kube_state_metrics.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "prometheus-kube-state-metrics"
      }
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "vpa_prometheus" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus"
      namespace = local.namespace
      labels    = module.kube_labels_prometheus.kube_labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "thanos-sidecar"
          minAllowed = {
            memory = "150Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "monitoring.coreos.com/v1"
        kind       = "Prometheus"
        name       = "monitoring"
      }
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "vpa_thanos_compactor" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "thanos-compactor"
      namespace = local.namespace
      labels    = module.kube_labels_thanos_compactor.kube_labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "compactor"
          minAllowed = {
            memory = "250Mi"
            cpu    = "250m"
          }
        }]
      }
      targetRef = {
        apiVersion = "batch/v1"
        kind       = "CronJob"
        name       = "thanos-compactor"
      }
    }
  }
  depends_on = [helm_release.thanos]
}

resource "kubernetes_manifest" "vpa_thanos_bucket_web" {
  count = var.vpa_enabled && var.thanos_bucket_web_enable ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "thanos-bucket-web"
      namespace = local.namespace
      labels    = module.kube_labels_thanos_bucket_web.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "thanos-bucketweb"
      }
    }
  }
  depends_on = [helm_release.thanos]
}

resource "kubernetes_manifest" "vpa_thanos_store_gateway" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "thanos-store-gateway"
      namespace = local.namespace
      labels    = module.kube_labels_thanos_store_gateway.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "thanos-storegateway"
      }
    }
  }
  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_manifest" "vpa_thanos_query_frontend" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "thanos-query-frontend"
      namespace = local.namespace
      labels    = module.kube_labels_thanos_query_frontend.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "thanos-query-frontend"
      }
    }
  }
  depends_on = [helm_release.thanos]
}

resource "kubernetes_manifest" "vpa_thanos_query" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "thanos-query"
      namespace = local.namespace
      labels    = module.kube_labels_thanos_query.kube_labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "query"
          minAllowed = {
            memory = "100Mi"
          }
        }]
      }

      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "thanos-query"
      }
    }
  }
  depends_on = [helm_release.thanos]
}

// This will not work until https://github.com/prometheus-operator/prometheus-operator/issues/6609
// is implemented
#resource "kubernetes_manifest" "vpa_alertmanager" {
#  count = var.vpa_enabled ? 1 : 0
#  manifest = {
#    apiVersion = "autoscaling.k8s.io/v1"
#    kind       = "VerticalPodAutoscaler"
#    metadata = {
#      name      = "alertmanager"
#      namespace = local.namespace
#      labels    = module.kube_labels_alertmanager.kube_labels
#    }
#    spec = {
#      targetRef = {
#        apiVersion = "monitoring.coreos.com/v1"
#        kind       = "Alertmanager"
#        name       = "monitoring"
#      }
#    }
#  }
#  depends_on = [helm_release.prometheus_stack]
#}

/***************************************
* SSO Login for Grafana
***************************************/


/***************************************
* Grafana Ingress
***************************************/

#module "proxy" {
#  count  = var.ingress_enabled ? 1 : 0
#  source = "../kube_vault_proxy"
#
#  namespace = local.namespace
#  pull_through_cache_enabled = var.pull_through_cache_enabled
#  vpa_enabled = var.vpa_enabled
#  domain = var.grafana_domain
#  vault_domain = var.vault_domain
#  upstream_service_name = "grafana"
#
#  # generate: pass_common_vars.snippet.txt
#  pf_stack_version = var.pf_stack_version
#  pf_stack_commit  = var.pf_stack_commit
#  environment      = var.environment
#  region           = var.region
#  pf_root_module   = var.pf_root_module
#  is_local         = var.is_local
#  extra_tags       = var.extra_tags
#  # end-generate
#
#  depends_on = [
#    helm_release.prometheus_stack
#  ]
#}


module "ingress" {
  count  = var.ingress_enabled ? 1 : 0
  source = "../kube_ingress"

  namespace = local.namespace
  name      = "grafana"
  ingress_configs = [{
    domains      = [var.grafana_domain]
    service      = "prometheus-grafana"
    service_port = 80
  }]

  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = true
  permissions_policy_enabled     = true
  csp_enabled                    = true

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate

  depends_on = [
    helm_release.prometheus_stack,
  ]
}
