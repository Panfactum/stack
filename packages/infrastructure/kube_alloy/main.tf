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
  }
}

data "aws_region" "current" {}

locals {

  name      = "alloy"
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

resource "random_id" "alloy" {
  byte_length = 8
  prefix      = "alloy-"
}

module "util" {
  source                  = "../kube_workload_utility"
  workload_name           = "alloy"
  burstable_nodes_enabled = true

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
* Alloy
***************************************/

resource "kubernetes_config_map" "alloy" {
  metadata {
    name      = "alloy-config"
    namespace = local.namespace
    labels    = module.util.labels
  }
  data = {
    "alloy.config" = templatefile("${path.module}/alloy.txt", {
      LOG_LEVEL = var.log_level
    })
  }
}

resource "helm_release" "alloy" {
  namespace       = local.namespace
  name            = "alloy"
  repository      = "https://grafana.github.io/helm-charts"
  chart           = "alloy"
  version         = var.alloy_chart_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "alloy"
      crds = {
        create = false
      }
      image = {
        registry = var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"
      }
      alloy = {
        clustering = {
          enabled = false
        }
        configMap = {
          create = false
          name   = kubernetes_config_map.alloy.metadata[0].name
          key    = "alloy.config"
        }
        mounts = {
          varlog = true
        }
        resources = {
          requests = {
            cpu    = "100m"
            memory = "150Mi"
          }
          limits = {
            memory = "${ceiling(150 * 1.3)}Mi"
          }
        }
      }
      controller = {
        type              = "daemonset"
        tolerations       = module.util.tolerations
        priorityClassName = "system-node-critical"
        podLabels         = module.util.labels
      }
      configReloader = {
        image = {
          registry = var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"
        }
        resources = {
          requests = {
            cpu    = "50m"
            memory = "20Mi"
          }
          limits = {
            memory = "${ceiling(20 * 1.3)}Mi"
          }
        }
      }
      serviceMonitor = {
        enabled  = var.monitoring_enabled
        interval = "60s"
      }
    })
  ]

  timeout = 300
}

/***************************************
* Autoscaling
***************************************/

resource "kubernetes_manifest" "vpa_alloy" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "alloy"
      namespace = local.namespace
      labels    = module.util.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "alloy"
          minAllowed = {
            memory = "150Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "alloy"
      }
    }
  }
  depends_on = [helm_release.alloy]
}
