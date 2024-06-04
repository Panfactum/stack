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

  name      = "canary"
  namespace = module.namespace.namespace

  default_resources = {
    requests = {
      cpu    = "100m"
      memory = "100Mi"
    }
    limits = {
      memory = "130Mi"
    }
  }
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "util" {
  source                               = "../kube_workload_utility"
  workload_name                        = "canary-checker"
  instance_type_anti_affinity_required = true
  burstable_nodes_enabled              = true

  # generate: common_vars.snippet.txt
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
* Database
***************************************/

module "database" {
  source = "../kube_pg_cluster"

  eks_cluster_name            = var.eks_cluster_name
  pg_cluster_namespace        = local.namespace
  pg_storage_gb               = 1
  pg_memory_mb                = 300
  pg_cpu_millicores           = 200
  pg_instances                = 2
  pg_shutdown_timeout         = 30
  aws_iam_ip_allow_list       = var.aws_iam_ip_allow_list
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  burstable_instances_enabled = true
  monitoring_enabled          = true
  backups_enabled             = true

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
* Canary Checker
***************************************/

resource "kubernetes_secret" "db_creds" {
  metadata {
    name      = "db-creds"
    namespace = local.namespace
    labels    = module.util.labels
  }
  data = {
    DB_URL = "postgresql://${module.database.superuser_username}:${module.database.superuser_password}@${module.database.pooler_rw_service_name}:${module.database.rw_service_port}/app"
  }
}

resource "helm_release" "canary" {
  namespace       = local.namespace
  name            = "canary"
  repository      = "https://flanksource.github.io/charts"
  chart           = "canary-checker"
  version         = var.canary_chart_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      #TODO: Need to add pod labels
      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/flanksource/canary-checker"
      }
      db = {
        external = {
          enabled = true
          create  = false
          secretKeyRef = {
            name = kubernetes_secret.db_creds.metadata[0].name
            key  = "DB_URL"
          }
        }
      }
      disablePostgrest = true
      logLevel         = "" # TODO: Json logs in next release
      flanksource-ui = {
        enabled = false
      }
      resources = local.default_resources
      extra = {
        tolerations = module.util.tolerations
      }
      serviceMonitor    = true
      grafanaDashboards = true
    })
  ]

  depends_on = [module.database]
  timeout    = 300
}

/***************************************
* Autoscaling
***************************************/

resource "kubernetes_manifest" "pdb_canary" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "canary-checker"
      namespace = local.namespace
    labels = module.util.labels }
    spec = {
      selector = {
        matchLabels = module.util.match_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.canary]
}

resource "kubernetes_manifest" "vpa_alloy" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "canary-checker"
      namespace = local.namespace
      labels    = module.util.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "canary-checker"
          minAllowed = {
            memory = "200Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "canary-checker"
      }
    }
  }
  depends_on = [helm_release.canary]
}
