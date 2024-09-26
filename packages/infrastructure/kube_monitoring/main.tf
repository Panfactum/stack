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
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
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
    "panfactum.com/stack-version",
    "panfactum.com/workload"
  ]

  labels_to_track = tolist(toset(concat(local.default_tracked_labels, var.additional_tracked_resource_labels)))

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
    registry = module.pull_through.quay_registry
  }

  default_docker_image = {
    registry = module.pull_through.docker_hub_registry
  }

  default_k8s_image = {
    registry = module.pull_through.kubernetes_registry
  }

  thanos_store_gateway_index_config = {
    type = "REDIS"
    config = {
      addr     = "${module.thanos_redis_cache.redis_master_host}:${module.thanos_redis_cache.redis_port}"
      username = "$(REDIS_USERNAME)"
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
      username = "$(REDIS_USERNAME)"
      password = "$(REDIS_PASSWORD)"
      # Sentinel cannot be used due to this issue: https://github.com/thanos-io/thanos/issues/6246
      # master_name = module.thanos_redis_cache.master_set
      cache_size = "$(MEMORY_REQUEST)MB"
      db         = 1
    }
  }

  thanos_query_frontend_caching_config = {
    type = "REDIS"
    config = {
      addr     = "${module.thanos_redis_cache.redis_master_host}:${module.thanos_redis_cache.redis_port}"
      username = "$(REDIS_USERNAME)"
      password = "$(REDIS_PASSWORD)"
      # Sentinel cannot be used due to this issue: https://github.com/thanos-io/thanos/issues/6246
      # master_name = module.thanos_redis_cache.master_set
      cache_size = "$(MEMORY_REQUEST)MB"
      db         = 2
    }
  }

  grafana_subdomain = join(".", slice(split(".", var.grafana_domain), 1, length(split(".", var.grafana_domain))))
  bucket_web_domain = var.thanos_bucket_web_domain != null ? var.thanos_bucket_web_domain : "thanos-bucket.${local.grafana_subdomain}"

  scheduler = var.panfactum_scheduler_enabled ? module.constants.panfactum_scheduler_name : "default-scheduler"
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util_webhook" {
  source = "../kube_workload_utility"

  workload_name                 = "prometheus-operator-webhook"
  burstable_nodes_enabled       = true
  arm_nodes_enabled             = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_preferred           = var.enhanced_ha_enabled

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

module "util_operator" {
  source = "../kube_workload_utility"

  workload_name                 = "prometheus-operator"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = false // only runs one copy
  az_spread_preferred           = false // only runs one copy

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

module "util_grafana" {
  source = "../kube_workload_utility"

  workload_name                 = "grafana"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_required            = true // stateful

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

module "util_prometheus" {
  source = "../kube_workload_utility"

  workload_name                 = "prometheus"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = false // Does not support custom schedulers yet
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_required            = true // stateful
  lifetime_evictions_enabled    = false

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

module "util_node_exporter" {
  source = "../kube_workload_utility"

  workload_name                 = "node-exporter"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  az_spread_preferred           = false // daemonset
  instance_type_spread_required = false // daemonset

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

module "util_ksm" {
  source = "../kube_workload_utility"

  workload_name                 = "kube-state-metrics"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_preferred           = var.enhanced_ha_enabled

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

module "util_thanos_compactor" {
  source = "../kube_workload_utility"

  workload_name                 = "thanos-compactor"
  burstable_nodes_enabled       = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  az_spread_preferred           = false // single pod
  instance_type_spread_required = false // single pod

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

module "util_thanos_store_gateway" {
  source                        = "../kube_workload_utility"
  workload_name                 = "thanos-store-gateway"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_required            = true // stateful so always on

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

module "util_thanos_ruler" {
  source                        = "../kube_workload_utility"
  workload_name                 = "thanos-ruler"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_required            = true // stateful so always on

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


module "util_thanos_query" {
  source = "../kube_workload_utility"

  workload_name                 = "thanos-query"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_preferred           = var.enhanced_ha_enabled

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

module "util_thanos_frontend" {
  source = "../kube_workload_utility"

  workload_name                 = "thanos-frontend"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_preferred           = var.enhanced_ha_enabled

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

module "util_thanos_bucket_web" {
  source = "../kube_workload_utility"

  workload_name                 = "thanos-bucket-web"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_preferred           = var.enhanced_ha_enabled

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

module "util_alertmanager" {
  source = "../kube_workload_utility"

  workload_name                 = "alertmanager"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = false // Does not support custom schedulers yet
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_required            = true // stateful so always on
  lifetime_evictions_enabled    = false

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

module "constants" {
  source = "../kube_constants"
}

/***************************************
* Namespace
***************************************/

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
* Grafana Database
***************************************/

module "grafana_db" {
  source = "../kube_pg_cluster"

  eks_cluster_name              = var.eks_cluster_name
  pg_cluster_namespace          = local.namespace
  pg_initial_storage_gb         = 1
  pg_memory_mb                  = 500
  pg_cpu_millicores             = 250
  pg_instances                  = 2
  aws_iam_ip_allow_list         = var.aws_iam_ip_allow_list
  pull_through_cache_enabled    = var.pull_through_cache_enabled
  pgbouncer_pool_mode           = "session"
  burstable_nodes_enabled       = true
  backups_force_delete          = true
  monitoring_enabled            = var.monitoring_enabled
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled

  pg_recovery_mode_enabled = var.grafana_db_recovery_mode_enabled
  pg_recovery_directory    = var.grafana_db_recovery_directory
  pg_recovery_target_time  = var.grafana_db_recovery_target_time

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
* Thanos Cache
***************************************/

module "thanos_redis_cache" {
  source = "../kube_redis_sentinel"

  namespace                     = local.namespace
  replica_count                 = 3
  lfu_cache_enabled             = true
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  pull_through_cache_enabled    = var.pull_through_cache_enabled
  vpa_enabled                   = var.vpa_enabled
  minimum_memory_mb             = 1000
  monitoring_enabled            = var.monitoring_enabled
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled

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
    labels    = module.util_prometheus.labels
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.prometheus.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.prometheus.json
  ip_allow_list             = var.aws_iam_ip_allow_list

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

resource "kubernetes_secret" "grafana_creds" {
  metadata {
    name      = "grafana-creds"
    namespace = local.namespace
  }
  data = {
    admin-user         = "admin"
    admin-password     = random_password.grafana_admin_pw.result
    oidc-client-secret = vault_identity_oidc_client.oidc.client_secret
  }
}

module "prometheus_cert" {
  source = "../kube_internal_cert"

  common_name   = "system:serviceaccount:${local.namespace}:${kubernetes_service_account.prometheus.metadata[0].name}"
  service_names = ["prometheus"]
  secret_name   = "prometheus-identity-cert"
  namespace     = local.namespace

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

resource "helm_release" "prometheus_stack" {
  namespace       = local.namespace
  name            = "prometheus"
  repository      = "https://prometheus-community.github.io/helm-charts"
  chart           = "kube-prometheus-stack"
  version         = var.kube_prometheus_stack_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = false
  wait_for_jobs   = false
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride                   = "monitoring"
      cleanPrometheusOperatorObjectNames = true
      labels                             = module.util_prometheus.labels
      commonLabels = {
        customizationHash = md5(join("", [
          for filename in sort(fileset(path.module, "prometheus_customize/*")) : filesha256(filename)
        ]))
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
        labels           = module.util_operator.labels
        podLabels        = module.util_operator.labels
        image            = local.default_image
        strategy = {
          type          = "Recreate"
          rollingUpdate = null
        }

        logFormat = "json"
        logLevel  = var.prometheus_operator_log_level

        priorityClassName = module.constants.cluster_important_priority_class_name
        tolerations       = module.util_operator.tolerations
        service = {
          labels = module.util_operator.labels
        }
        resources = local.default_resources
        admissionWebhooks = {
          deployment = {
            enabled     = true
            image       = local.default_image
            labels      = module.util_webhook.labels
            podLabels   = module.util_webhook.labels
            replicas    = 2
            tolerations = module.util_webhook.tolerations
            affinity    = module.util_webhook.affinity
            service = {
              labels = module.util_webhook.labels
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
        podLabels         = module.util_node_exporter.labels
        image             = local.default_image

        # This is required because linkerd cannot proxy containers that have access to the host network
        # which this requires in order to collect its metrics.
        # Without this, requests would not have mTLS.
        kubeRBACProxy = {
          enabled   = true
          image     = local.default_image
          resources = local.default_resources
        }

        prometheus = {
          monitor = {
            enabled        = true
            scheme         = "https"
            scrapeInterval = "${var.prometheus_default_scrape_interval_seconds}s"
            # TODO: This is deprecated and we should use the identity certs instead;
            # however, this issue is a blocker: https://github.com/prometheus-community/helm-charts/issues/4552
            bearerTokenFile = "/var/run/secrets/kubernetes.io/serviceaccount/token"
            tlsConfig = {
              # TODO: We need to do this because the self-signed certs are based on the pod hostname which is dynamic
              # When this is fixed, we can update this: https://github.com/prometheus-community/helm-charts/issues/4552
              insecureSkipVerify = true
            }
          }
        }

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
          module.util_node_exporter.tolerations
        )
        resources = local.default_resources
      }

      //////////////////////////////////////////////////////////
      // Kube-state-metrics sub-chart
      //////////////////////////////////////////////////////////
      kube-state-metrics = {
        image        = local.default_k8s_image
        customLabels = module.util_ksm.labels
        extraArgs = [
          "--metric-labels-allowlist=*=[${join(",", local.labels_to_track)}]"
        ]
        updateStrategy = "Recreate"
        tolerations    = module.util_ksm.tolerations
        resources = {
          requests = {
            memory = "300Mi"
          }
          limits = {
            memory = "390Mi"
          }
        }

        collectors = local.resources_to_track

        rbac = {
          extraRules = [
            {
              apiGroups = ["autoscaling.k8s.io"]
              resources = ["verticalpodautoscalers"]
              verbs     = ["list", "watch"]
            }
          ]
        }

        customResourceState = {
          enabled = true
          config = {
            kind = "CustomResourceStateMetrics"
            spec = {
              resources = [
                {
                  groupVersionKind = {
                    group   = "autoscaling.k8s.io"
                    kind    = "VerticalPodAutoscaler"
                    version = "v1"
                  }
                  labelsFromPath = {
                    verticalpodautoscaler = ["metadata", "name"]
                    namespace             = ["metadata", "namespace"]
                    target_api_version    = ["apiVersion"]
                    target_kind           = ["spec", "targetRef", "kind"]
                    target_name           = ["spec", "targetRef", "name"]
                  }
                  metrics = [
                    {
                      name = "vpa_containerrecommendations_target"
                      help = "VPA container recommendations for memory."
                      each = {
                        type = "Gauge"
                        gauge = {
                          path      = ["status", "recommendation", "containerRecommendations"]
                          valueFrom = ["target", "memory"]
                          labelsFromPath = {
                            container = ["containerName"]
                          }
                        }
                      }
                      commonLabels = {
                        resource = "memory"
                        unit     = "byte"
                      }
                    },
                    {
                      name = "vpa_containerrecommendations_target"
                      help = "VPA container recommendations for CPU."
                      each = {
                        type = "Gauge"
                        gauge = {
                          path      = ["status", "recommendation", "containerRecommendations"]
                          valueFrom = ["target", "cpu"]
                          labelsFromPath = {
                            container = ["containerName"]
                          }
                        }
                      }
                      commonLabels = {
                        resource = "cpu"
                        unit     = "core"
                      }
                    },
                  ]
                }
              ]
            }
          }
        }

        selfMonitor = {
          enabled = true
        }

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
                "label_panfactum_com_root_module",
                "label_panfactum_com_workload"
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
        enabled = var.kube_api_server_monitoring_enabled
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
          labels  = module.util_prometheus.labels
        }
        thanosServiceMonitor = {
          enabled          = true
          additionalLabels = module.util_prometheus.labels
        }
        prometheusSpec = {
          podMetadata = {
            labels = module.util_prometheus.labels
          }
          image                     = local.default_image
          replicas                  = 2
          tolerations               = module.util_prometheus.tolerations
          affinity                  = module.util_prometheus.affinity
          topologySpreadConstraints = module.util_prometheus.topology_spread_constraints
          priorityClassName         = module.constants.cluster_important_priority_class_name
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
          ruleNamespaceSelector = {
            matchLabels = { "monitoring/enabled" = "true" }
          }
          ruleSelector                  = {}
          ruleSelectorNilUsesHelmValues = false
          serviceMonitorNamespaceSelector = {
            matchLabels = { "monitoring/enabled" = "true" }
          }
          serviceMonitorSelector                  = {}
          serviceMonitorSelectorNilUsesHelmValues = false
          podMonitorNamespaceSelector = {
            matchLabels = { "monitoring/enabled" = "true" }
          }
          podMonitorSelector                  = {}
          podMonitorSelectorNilUsesHelmValues = false
          probeNamespaceSelector = {
            matchLabels = { "monitoring/enabled" = "true" }
          }
          probeSelector                  = {}
          probeSelectorNilUsesHelmValues = false
          scrapeConfigNamespaceSelector = {
            matchLabels = { "monitoring/enabled" = "true" }
          }
          scrapeConfigSelector                  = {}
          scrapeConfigSelectorNilUsesHelmValues = false

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

          volumes = [
            {
              name = "identity-certs"
              secret = {
                defaultMode = 420
                secretName  = module.prometheus_cert.secret_name
              }
            }
          ]
          volumeMounts = [
            {
              mountPath = "/etc/prometheus/identity-certs"
              name      = "identity-certs"
              readOnly  = true
            }
          ]

          thanos = {
            image     = "${module.pull_through.quay_registry}/thanos/thanos:${var.thanos_image_version}"
            logLevel  = var.prometheus_log_level
            logFormat = "json"
            resources = local.default_resources
            blockSize = "30m"
            objectStorageConfig = {
              secret = {
                type = "s3"
                config = {
                  bucket       = module.metrics_bucket.bucket_name
                  region       = data.aws_region.current.name
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
          labels = module.util_alertmanager.labels
        }
        alertmanagerSpec = {
          podMetadata = {
            labels = module.util_alertmanager.labels
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
              }
            }
          }

          replicas                  = 2
          resources                 = local.default_resources
          affinity                  = module.util_alertmanager.affinity
          tolerations               = module.util_alertmanager.tolerations
          topologySpreadConstraints = module.util_alertmanager.topology_spread_constraints
          priorityClassName         = module.constants.cluster_important_priority_class_name
        }
      }

      //////////////////////////////////////////////////////////
      // Grafana
      //////////////////////////////////////////////////////////
      grafana = {
        enabled                  = true
        defaultDashboardsEnabled = false // We load custom ones
        image                    = local.default_docker_image
        extraLabels              = module.util_grafana.labels
        podLabels                = module.util_grafana.labels
        annotations = {
          "reloader.stakater.com/auto" = "true"
        }

        plugins = [
          "marcusolsson-hexmap-panel"
        ]

        admin = {
          existingSecret = kubernetes_secret.grafana_creds.metadata[0].name
          userKey        = "admin-user"
          passwordKey    = "admin-password"
        }
        envValueFrom = {
          GF_DATABASE_PASSWORD = {
            secretKeyRef = {
              name = module.grafana_db.superuser_creds_secret
              key  = "password"
            }
          }
          GF_DATABASE_USER = {
            secretKeyRef = {
              name = module.grafana_db.superuser_creds_secret
              key  = "username"
            }
          }
          GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET = {
            secretKeyRef = {
              name = kubernetes_secret.grafana_creds.metadata[0].name
              key  = "oidc-client-secret"
            }
          }
        }
        sidecar = {
          image     = local.default_image
          resources = local.default_image
          datasources = {
            enabled = false // this sidecar does not work properly :(
          }
        }
        datasources = {
          "datasources.yaml" = {
            apiVersion = 1
            deleteDatasources = [
              { name = "Prometheus" },
              { name = "Prometheus2" },
              { name = "Alertmanager" },
              { name = "Thanos" },
              { name = "Loki" }
            ]
            datasources = [
              {
                name   = "Prometheus"
                uid    = "prometheus"
                type   = "prometheus"
                url    = "http://monitoring-prometheus.monitoring:9090/"
                access = "proxy"
                jsonData = {
                  httpMethod   = "POST"
                  timeInterval = "60s"
                }
                editable = false
                orgId    = 1
                version  = 2
              },
              {
                name      = "Thanos"
                uid       = "thanos"
                type      = "prometheus"
                url       = "http://thanos-query-frontend.monitoring:9090/"
                access    = "proxy"
                isDefault = true
                jsonData = {
                  httpMethod   = "POST"
                  timeInterval = "60s"
                  timeout      = 55
                }
                editable = false
                orgId    = 1
                version  = 2
              },
              {
                name   = "Alertmanager"
                type   = "alertmanager"
                uid    = "alertmanager"
                url    = "http://monitoring-alertmanager.monitoring:9093/"
                access = "proxy"
                jsonData = {
                  handleGrafanaManagedAlerts = false
                  implementation             = "prometheus"
                  timeout                    = 55
                }
                editable = false
                orgId    = 1
                version  = 2
              },
              {
                name     = "Loki"
                type     = "loki"
                uid      = "loki"
                url      = "http://loki-read.logging.svc.cluster.local:3100/"
                access   = "proxy"
                editable = false
                jsonData = {
                  manageAlerts    = true
                  alertmanagerUid = "alertmanager"
                  timeout         = 55
                }
                version = 2
                orgId   = 1
              }
            ]
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
            name          = module.grafana_db.database
            user          = "default"
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
            client_secret              = "replace-me" # Replaced by environment variable, but a default must be set
            auth_url                   = "https://${var.vault_domain}/ui/vault/identity/oidc/provider/grafana/authorize?with=oidc"
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
        tolerations               = module.util_grafana.tolerations
        affinity                  = module.util_grafana.affinity
        topologySpreadConstraints = module.util_grafana.topology_spread_constraints

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
    args        = [local.scheduler]
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
  for_each   = toset(["rbac-superusers", "rbac-admins", "rbac-readers", "rbac-restricted-readers"])
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
    labels    = module.util_thanos_compactor.labels
  }
}

module "aws_permissions_thanos_compactor" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.thanos_compactor.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.prometheus.json
  ip_allow_list             = var.aws_iam_ip_allow_list

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

resource "kubernetes_service_account" "thanos_store_gateway" {
  metadata {
    name      = "thanos-store-gateway"
    namespace = local.namespace
    labels    = module.util_thanos_store_gateway.labels
  }
}

module "aws_permissions_thanos_store_gateway" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.thanos_store_gateway.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.prometheus.json
  ip_allow_list             = var.aws_iam_ip_allow_list

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

resource "kubernetes_service_account" "thanos_ruler" {
  metadata {
    name      = "thanos-ruler"
    namespace = local.namespace
    labels    = module.util_thanos_ruler.labels
  }
}

module "aws_permissions_thanos_ruler" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.thanos_ruler.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.prometheus.json
  ip_allow_list             = var.aws_iam_ip_allow_list

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

resource "kubernetes_service_account" "thanos_bucket_web" {
  metadata {
    name      = "thanos-bucket-web"
    namespace = local.namespace
    labels    = module.util_thanos_bucket_web.labels
  }
}

module "aws_permissions_thanos_bucket_web" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.thanos_bucket_web.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.prometheus.json
  ip_allow_list             = var.aws_iam_ip_allow_list

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



resource "helm_release" "thanos" {
  namespace       = local.namespace
  name            = "thanos"
  repository      = "oci://registry-1.docker.io/bitnamicharts"
  chart           = "thanos"
  version         = var.thanos_chart_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = false
  wait_for_jobs   = false
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "thanos"
      global = {
        imageRegistry = module.pull_through.docker_hub_registry
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

        podLabels = module.util_thanos_query.labels
        service = {
          labels = module.util_thanos_query.labels
        }
        replicaCount              = 2
        priorityClassName         = module.constants.cluster_important_priority_class_name
        topologySpreadConstraints = module.util_thanos_query.topology_spread_constraints
        affinity                  = module.util_thanos_query.affinity
        tolerations               = module.util_thanos_query.tolerations
        schedulerName             = local.scheduler
        resources                 = local.default_resources

        networkPolicy = {
          enabled = false
        }
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
                name     = module.thanos_redis_cache.superuser_creds_secret
                key      = "password"
                optional = false
              }
            }
          },
          {
            name = "REDIS_USERNAME"
            valueFrom = {
              secretKeyRef = {
                name     = module.thanos_redis_cache.superuser_creds_secret
                key      = "username"
                optional = false
              }
            }
          },
          {
            name = "MEMORY_REQUEST"
            valueFrom = {
              resourceFieldRef = {
                containerName = "query-frontend"
                resource      = "requests.memory"
                divisor       = "1M"
              }
            }
          }
        ]

        podLabels = module.util_thanos_frontend.labels
        service = {
          labels = module.util_thanos_frontend.labels
        }
        replicaCount              = 2
        priorityClassName         = module.constants.cluster_important_priority_class_name
        topologySpreadConstraints = module.util_thanos_frontend.topology_spread_constraints
        affinity                  = module.util_thanos_frontend.affinity
        tolerations               = module.util_thanos_frontend.tolerations
        schedulerName             = local.scheduler
        resources                 = local.default_resources

        networkPolicy = {
          enabled = false
        }
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
          labels = module.util_thanos_bucket_web.labels
        }
        updateStrategy = {
          type = "Recreate"
        }
        affinity      = module.util_thanos_bucket_web.affinity
        podLabels     = module.util_thanos_bucket_web.labels
        tolerations   = module.util_thanos_bucket_web.tolerations
        schedulerName = local.scheduler
        resources     = local.default_resources

        networkPolicy = {
          enabled = false
        }
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

        podLabels = module.util_thanos_compactor.labels
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
        tolerations       = module.util_thanos_compactor.tolerations
        schedulerName     = local.scheduler
        priorityClassName = module.constants.cluster_important_priority_class_name
        resources = {
          requests = {
            cpu    = "200m"
            memory = "400Mi"
          }
          limits = {
            memory = "520Mi"
          }
        }

        networkPolicy = {
          enabled = false
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
                name     = module.thanos_redis_cache.superuser_creds_secret
                key      = "password"
                optional = false
              }
            }
          },
          {
            name = "REDIS_USERNAME"
            valueFrom = {
              secretKeyRef = {
                name     = module.thanos_redis_cache.superuser_creds_secret
                key      = "username"
                optional = false
              }
            }
          },
          {
            name = "MEMORY_REQUEST"
            valueFrom = {
              resourceFieldRef = {
                containerName = "storegateway"
                resource      = "requests.memory"
                divisor       = "1M"
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
          labels = module.util_thanos_store_gateway.labels
        }
        persistence = {
          enabled      = true
          storageClass = var.thanos_store_gateway_storage_class_name
        }
        podLabels                 = module.util_thanos_store_gateway.labels
        replicaCount              = 2
        priorityClassName         = module.constants.cluster_important_priority_class_name
        topologySpreadConstraints = module.util_thanos_store_gateway.topology_spread_constraints
        affinity                  = module.util_thanos_store_gateway.affinity
        tolerations               = module.util_thanos_store_gateway.tolerations
        schedulerName             = local.scheduler
        resources                 = local.default_resources

        networkPolicy = {
          enabled = false
        }
      }
      ruler = {
        enabled = true
        serviceAccount = {
          create = false
          name   = kubernetes_service_account.thanos_store_gateway.metadata[0].name
        }
        tolerations   = module.util_thanos_ruler.tolerations
        schedulerName = local.scheduler
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
        persistence = {
          enabled      = true
          storageClass = var.thanos_ruler_storage_class_name
          size         = "2Gi"
        }
        networkPolicy = {
          enabled = false
        }
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
            region       = data.aws_region.current.name
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

resource "kubectl_manifest" "pdb_prometheus_operator" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "prometheus-operator"
      namespace = local.namespace
      labels    = module.util_operator.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_operator.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "pdb_prometheus_operator_webhook" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "prometheus-operator-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_webhook.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "pdb_grafana" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "prometheus-grafana"
      namespace = local.namespace
      labels    = module.util_grafana.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_grafana.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "pdb_kube_state_metrics" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "prometheus-kube-state-metrics"
      namespace = local.namespace
      labels    = module.util_ksm.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_ksm.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "pdb_prometheus" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "prometheus"
      namespace = local.namespace
      labels    = module.util_prometheus.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_prometheus.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "pdb_thanos_compactor" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "thanos-compactor"
      namespace = local.namespace
      labels    = module.util_thanos_compactor.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_thanos_compactor.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.thanos]
}

resource "kubectl_manifest" "pdb_thanos_bucket_web" {
  count = var.thanos_bucket_web_enable ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "thanos-bucket-web"
      namespace = local.namespace
      labels    = module.util_thanos_bucket_web.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_thanos_bucket_web.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.thanos]
}

resource "kubectl_manifest" "pdb_thanos_store_gateway" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "thanos-store-gateway"
      namespace = local.namespace
      labels    = module.util_thanos_store_gateway.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_thanos_store_gateway.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.thanos]
}

resource "kubectl_manifest" "pdb_thanos_query_frontend" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "thanos-query-frontend"
      namespace = local.namespace
      labels    = module.util_thanos_frontend.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_thanos_frontend.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.thanos]
}

resource "kubectl_manifest" "pdb_thanos_query" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "thanos-query"
      namespace = local.namespace
      labels    = module.util_thanos_query.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_thanos_query.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.thanos]
}

resource "kubectl_manifest" "alertmanager" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "alertmanager"
      namespace = local.namespace
      labels    = module.util_alertmanager.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_alertmanager.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

/***************************************
* Autoscaling
***************************************/

resource "kubernetes_annotations" "prometheus_pvc" {
  count       = 2
  api_version = "v1"
  kind        = "PersistentVolumeClaim"
  metadata {
    name      = "prometheus-monitoring-db-prometheus-monitoring-${count.index}"
    namespace = local.namespace
  }
  annotations = {
    "velero.io/exclude-from-backup"   = "true"
    "resize.topolvm.io/storage_limit" = "100Gi"
    "resize.topolvm.io/increase"      = "5Gi"
    "resize.topolvm.io/threshold"     = "20%"
  }
  force = true

  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_annotations" "alertmanager_pvc" {
  count       = 2
  api_version = "v1"
  kind        = "PersistentVolumeClaim"
  metadata {
    name      = "alertmanager-monitoring-db-alertmanager-monitoring-${count.index}"
    namespace = local.namespace
  }
  annotations = {
    "velero.io/exclude-from-backup"   = "true"
    "resize.topolvm.io/storage_limit" = "100Gi"
    "resize.topolvm.io/increase"      = "5Gi"
    "resize.topolvm.io/threshold"     = "20%"
  }
  force = true

  depends_on = [helm_release.prometheus_stack]
}

resource "kubernetes_annotations" "thanos_store_gateway_pvc" {
  count       = 2
  api_version = "v1"
  kind        = "PersistentVolumeClaim"
  metadata {
    name      = "data-thanos-storegateway-${count.index}"
    namespace = local.namespace
  }
  annotations = {
    "velero.io/exclude-from-backup"   = "true"
    "resize.topolvm.io/storage_limit" = "100Gi"
    "resize.topolvm.io/increase"      = "5Gi"
    "resize.topolvm.io/threshold"     = "20%"
  }
  force = true

  depends_on = [helm_release.thanos]
}

resource "kubernetes_annotations" "thanos_ruler_pvc" {
  count       = 1
  api_version = "v1"
  kind        = "PersistentVolumeClaim"
  metadata {
    name      = "data-thanos-ruler-${count.index}"
    namespace = local.namespace
  }
  annotations = {
    "velero.io/exclude-from-backup"   = "true"
    "resize.topolvm.io/storage_limit" = "100Gi"
    "resize.topolvm.io/increase"      = "5Gi"
    "resize.topolvm.io/threshold"     = "20%"
  }
  force = true


  depends_on = [helm_release.thanos]
}

resource "kubectl_manifest" "vpa_prometheus_operator" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus-operator"
      namespace = local.namespace
      labels    = module.util_operator.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "prometheus-operator"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "vpa_prometheus_operator_webhook" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus-operator-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "prometheus-operator-webhook"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "vpa_grafana" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus-grafana"
      namespace = local.namespace
      labels    = module.util_grafana.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "prometheus-grafana"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "vpa_node_exporter" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus-node-exporter"
      namespace = local.namespace
      labels    = module.util_node_exporter.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "node-exporter"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "vpa_kube_state_metrics" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus-kube-state-metrics"
      namespace = local.namespace
      labels    = module.util_ksm.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "kube-state-metrics"
          minAllowed = {
            memory = "250Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "prometheus-kube-state-metrics"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "vpa_prometheus" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "prometheus"
      namespace = local.namespace
      labels    = module.util_prometheus.labels
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
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "vpa_thanos_compactor" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "thanos-compactor"
      namespace = local.namespace
      labels    = module.util_thanos_compactor.labels
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
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.thanos]
}

resource "kubectl_manifest" "vpa_thanos_bucket_web" {
  count = var.vpa_enabled && var.thanos_bucket_web_enable ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "thanos-bucket-web"
      namespace = local.namespace
      labels    = module.util_thanos_bucket_web.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "thanos-bucketweb"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.thanos]
}

resource "kubectl_manifest" "vpa_thanos_store_gateway" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "thanos-store-gateway"
      namespace = local.namespace
      labels    = module.util_thanos_store_gateway.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "storegateway"
          minAllowed = {
            memory = "1000Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "thanos-storegateway"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.prometheus_stack]
}

resource "kubectl_manifest" "vpa_thanos_query_frontend" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "thanos-query-frontend"
      namespace = local.namespace
      labels    = module.util_thanos_store_gateway.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "query-frontend"
          minAllowed = {
            memory = "1000Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "thanos-query-frontend"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.thanos]
}

resource "kubectl_manifest" "vpa_thanos_query" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "thanos-query"
      namespace = local.namespace
      labels    = module.util_thanos_query.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "query"
          minAllowed = {
            memory = "1000Mi"
          }
        }]
      }

      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "thanos-query"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.thanos]
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
#      labels    = module.util_alertmanager.labels
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
* Extra Dashboards
***************************************/

resource "kubernetes_config_map" "dashboard" {
  metadata {
    name   = "panfactum-dashboards"
    labels = merge(module.util_grafana.labels, { "grafana_dashboard" = "1" })
  }
  data = { for name in fileset("${path.module}/dashboards", "*.json") : name => file("${path.module}/dashboards/${name}") }
}

/***************************************
* Ingresses
***************************************/

module "authenticating_proxy" {
  count  = var.ingress_enabled && var.thanos_bucket_web_enable ? 1 : 0
  source = "../kube_vault_proxy"

  namespace                     = local.namespace
  pull_through_cache_enabled    = var.pull_through_cache_enabled
  vpa_enabled                   = var.vpa_enabled
  domain                        = local.bucket_web_domain
  vault_domain                  = var.vault_domain
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_preferred           = var.enhanced_ha_enabled
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled

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

module "bucket_web_ingress" {
  count  = var.ingress_enabled && var.thanos_bucket_web_enable ? 1 : 0
  source = "../kube_ingress"

  namespace = local.namespace
  name      = "bucket-web"
  ingress_configs = [{
    domains      = [local.bucket_web_domain]
    service      = "thanos-bucketweb"
    service_port = 8080
  }]

  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = true
  permissions_policy_enabled     = true
  csp_enabled                    = true
  csp_default_src                = "'self' 'unsafe-inline'"
  extra_annotations              = module.authenticating_proxy[0].upstream_ingress_annotations
  extra_configuration_snippet    = file("${path.module}/bucket_configuration_snippet.txt") # Blocks mutating requests

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
