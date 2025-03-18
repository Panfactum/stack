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
  name      = "airbyte"
  namespace = module.namespace.namespace
}

resource "kubernetes_service_account" "airbyte_sa" {
  metadata {
    name      = "airbyte-sa"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
}

data "aws_region" "current" {}

data "pf_kube_labels" "labels" {
  module = "kube_airbyte"
}

module "constants" {
  source = "../kube_constants"
}

# Generate labels for different Airbyte components
module "util_webapp" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-webapp"
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

module "util_server" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-server"
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

  workload_name                        = "airbyte-worker"
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

module "util_temporal" {
  source = "../kube_workload_utility"

  workload_name                        = "airbyte-temporal"
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
  pg_initial_storage_gb                = var.pg_initial_storage_gb
  pg_instances                         = var.sla_target >= 2 ? 2 : 1
  pg_smart_shutdown_timeout            = 1
  pg_minimum_memory_mb                 = 500
  aws_iam_ip_allow_list                = var.aws_iam_ip_allow_list
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  pgbouncer_pool_mode                  = "transaction"
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  controller_nodes_enabled             = false
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.sla_target == 3
  vpa_enabled                          = var.vpa_enabled

  pg_backup_directory      = var.db_backup_directory
  pg_recovery_mode_enabled = var.db_recovery_mode_enabled
  pg_recovery_directory    = var.db_recovery_directory
  pg_recovery_target_time  = var.db_recovery_target_time
}

/***************************************
* S3 Storage Configuration
***************************************/

resource "random_id" "airbyte_bucket_name" {
  byte_length = 8
  prefix      = "airbyte-"
}

module "airbyte_bucket" {
  source      = "../aws_s3_private_bucket"
  bucket_name = random_id.airbyte_bucket_name.hex
  description = "Airbyte storage for logs, state, and workload output"

  intelligent_transitions_enabled = true
}

data "aws_iam_policy_document" "airbyte_bucket" {
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject"
    ]
    resources = ["${module.airbyte_bucket.bucket_arn}/*"]
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket"
    ]
    resources = [module.airbyte_bucket.bucket_arn]
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:GetBucketLocation"
    ]
    resources = ["arn:aws:s3:::*"]
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.airbyte_sa.metadata[0].name
  service_account_namespace = local.namespace
  iam_policy_json           = data.aws_iam_policy_document.airbyte_bucket.json
  ip_allow_list             = var.aws_iam_ip_allow_list
}

/***************************************
* Airbyte Helm Chart
***************************************/

resource "random_password" "bootstrap_password" {
  length  = 32
  special = false
}

resource "kubernetes_secret" "airbyte_secrets" {
  metadata {
    name      = "airbyte-config-secrets"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }

  data = {
    "license-key"       = var.license_key # For enterprise edition
  }
}

resource "helm_release" "airbyte" {
  namespace       = local.namespace
  name            = "airbyte"
  repository      = "https://airbytehq.github.io/helm-charts"
  chart           = "airbyte"
  version         = var.airbyte_helm_version
  recreate_pods   = false
  atomic          = var.wait
  cleanup_on_fail = var.wait
  wait            = var.wait
  force_update    = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "airbyte"

      global = {
        edition = var.airbyte_edition
        serviceAccountName = "airbyte-admin"
        airbyteUrl = var.domain != "" ? "https://${var.domain}" : ""
        env_vars = {}

        auth = {
          enabled = var.auth_enabled
          instanceAdmin = {
            secretName = "airbyte-config-secrets"
            emailSecretKey = "instance-admin-email"
            passwordSecretKey = "instance-admin-password"
          }
        }

        database = {
          type = "external"
          host = module.database.pooler_rw_service_name
          port = module.database.pooler_rw_service_port
          database = module.database.database
          user = module.database.superuser_username
          password = module.database.superuser_password
        }

        storage = {
          type = "s3"
          bucket = {
            log = module.airbyte_bucket.bucket_name
            state = module.airbyte_bucket.bucket_name
            workloadOutput = module.airbyte_bucket.bucket_name
          }
          s3 = {
            region             = data.aws_region.current.name
            authenticationType = "instanceProfile"
          }
        }

        jobs = {
          resources = {
            requests = {
              memory = "256Mi"
              cpu = "250m"
            }
            limits = {
              memory = "1Gi"
              cpu = "1"
            }
          }
          kube = {
            annotations = {}
            labels = {}
            nodeSelector = var.node_selector
            tolerations = var.tolerations
          }
        }
      }

      # Webapp config
      webapp = {
        enabled = true
        replicaCount = var.webapp_replicas
        podLabels = module.util_webapp.labels
        podAnnotations = var.pod_annotations

        affinity = module.util_webapp.affinity
        tolerations = module.util_webapp.tolerations
        nodeSelector = var.node_selector

        resources = {
          requests = {
            memory = var.webapp_memory_request
            cpu = var.webapp_cpu_request
          }
          limits = {
            memory = var.webapp_memory_limit
            cpu = var.webapp_cpu_limit
          }
        }

        service = {
          type = "ClusterIP"
          port = 80
          annotations = {}
        }

        ingress = {
          enabled = false # We'll use our own ingress module
        }
      }

      # Server config
      server = {
        enabled = true
        replicaCount = var.server_replicas
        podLabels = module.util_server.labels
        podAnnotations = var.pod_annotations

        affinity = module.util_server.affinity
        tolerations = module.util_server.tolerations
        nodeSelector = var.node_selector

        log = {
          level = var.log_level
        }

        resources = {
          requests = {
            memory = var.server_memory_request
            cpu = var.server_cpu_request
          }
          limits = {
            memory = var.server_memory_limit
            cpu = var.server_cpu_limit
          }
        }
      }

      # Worker config
      worker = {
        enabled = true
        replicaCount = var.worker_replicas
        podLabels = module.util_worker.labels
        podAnnotations = var.pod_annotations

        affinity = module.util_worker.affinity
        tolerations = module.util_worker.tolerations
        nodeSelector = var.node_selector

        log = {
          level = var.log_level
        }

        resources = {
          requests = {
            memory = var.worker_memory_request
            cpu = var.worker_cpu_request
          }
          limits = {
            memory = var.worker_memory_limit
            cpu = var.worker_cpu_limit
          }
        }
      }

      # Temporal config
      temporal = {
        enabled = true
        replicaCount = var.temporal_replicas
        podLabels = module.util_temporal.labels
        podAnnotations = var.pod_annotations

        affinity = module.util_temporal.affinity
        tolerations = module.util_temporal.tolerations
        nodeSelector = var.node_selector

        resources = {
          requests = {
            memory = var.temporal_memory_request
            cpu = var.temporal_cpu_request
          }
          limits = {
            memory = var.temporal_memory_limit
            cpu = var.temporal_cpu_limit
          }
        }

        service = {
          type = "ClusterIP"
          port = 7233
        }
      }

      # Pod sweeper configuration to clean up completed jobs
      "pod-sweeper" = {
        enabled = true
        podLabels = data.pf_kube_labels.labels.labels
        podAnnotations = var.pod_annotations
      }

      # Enable other components as needed
      "connector-builder-server" = {
        enabled = var.connector_builder_enabled
      }

      # Disable internal PostgreSQL since we're using our own
      postgresql = {
        enabled = false
      }

      # Disable minio since we're using S3
      minio = {
        enabled = false
      }


    })
  ]

  depends_on = [
    module.database,
    kubernetes_secret.airbyte_secrets
  ]
}

/***************************************
* Airbyte Ingress
***************************************/

module "ingress" {
  count     = var.ingress_enabled ? 1 : 0
  source    = "../kube_ingress"
  namespace = local.namespace
  name      = "airbyte"
  domains   = [var.domain]
  ingress_configs = [{
    service      = "airbyte-webapp"
    service_port = 80

    cdn = {
      default_cache_behavior = {
        caching_enabled = false
      }
      path_match_behavior = {
        # Static assets can be cached
        "/static*" = {
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
  cross_origin_embedder_policy   = "credentialless"
  permissions_policy_enabled     = true
  csp_enabled                    = true
  cross_origin_opener_policy     = "same-origin-allow-popups"

  # CSP configuration
  csp_style_src  = "'self' 'unsafe-inline'"
  csp_script_src = "'self' 'unsafe-inline'"
  csp_img_src    = "'self' data:"

  depends_on = [helm_release.airbyte]
}

# Add CDN if enabled
module "cdn" {
  count  = var.ingress_enabled && var.cdn_mode_enabled ? 1 : 0
  source = "../kube_aws_cdn"
  providers = {
    aws.global = aws.global
  }

  name           = "airbyte"
  origin_configs = module.ingress[0].cdn_origin_configs
}

/***************************************
* Pod Disruption Budgets and VPAs
***************************************/

resource "kubectl_manifest" "pdb_webapp" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-webapp"
      namespace = local.namespace
      labels    = module.util_webapp.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_webapp.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "pdb_server" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-server"
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
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "pdb_worker" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "airbyte-worker"
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
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_webapp" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-webapp"
      namespace = local.namespace
      labels    = module.util_webapp.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "webapp"
          minAllowed = {
            memory = var.webapp_memory_request
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
        name       = "airbyte-webapp"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_server" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-server"
      namespace = local.namespace
      labels    = module.util_server.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "server"
          minAllowed = {
            memory = var.server_memory_request
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
        name       = "airbyte-server"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

resource "kubectl_manifest" "vpa_worker" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "airbyte-worker"
      namespace = local.namespace
      labels    = module.util_worker.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "worker"
          minAllowed = {
            memory = var.worker_memory_request
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
        name       = "airbyte-worker"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.airbyte]
}

/***************************************
* Image Cache (Optional)
***************************************/

module "image_cache" {
  count  = var.node_image_cached_enabled ? 1 : 0
  source = "../kube_node_image_cache"

  images = [
    {
      registry   = "airbyte"
      repository = "webapp"
      tag        = var.airbyte_version
    },
    {
      registry   = "airbyte"
      repository = "server"
      tag        = var.airbyte_version
    },
    {
      registry   = "airbyte"
      repository = "worker"
      tag        = var.airbyte_version
    },
    {
      registry   = "temporalio"
      repository = "auto-setup"
      tag        = "1.26"
    }
  ]
}