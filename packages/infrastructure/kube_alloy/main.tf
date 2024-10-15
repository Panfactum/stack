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
      version = "5.70.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

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

data "aws_region" "current" {}

data "pf_kube_labels" "labels" {
  module = "kube_alloy"
}

module "pull_through" {
  source = "../aws_ecr_pull_through_cache_addresses"

  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util" {
  source = "../kube_workload_utility"

  workload_name            = "alloy"
  burstable_nodes_enabled  = true
  controller_nodes_enabled = true
  extra_labels             = data.pf_kube_labels.labels.labels
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
        registry = module.pull_through.docker_hub_registry
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
            memory = "${floor(150 * 1.3)}Mi"
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
          registry = module.pull_through.github_registry
        }
        resources = {
          requests = {
            cpu    = "50m"
            memory = "20Mi"
          }
          limits = {
            memory = "${floor(20 * 1.3)}Mi"
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

resource "kubectl_manifest" "vpa_alloy" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
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
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.alloy]
}
