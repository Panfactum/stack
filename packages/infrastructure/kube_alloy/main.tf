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
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
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

data "pf_kube_labels" "labels" {
  module = "kube_alloy"
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
  atomic          = true
  force_update    = true
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

/***************************************
* Image Cache
***************************************/

module "image_cache" {
  count  = var.node_image_cached_enabled ? 1 : 0
  source = "../kube_node_image_cache"

  images = [
    {
      registry    = "docker.io"
      repository  = "grafana/alloy"
      tag         = "v1.1.0"
      pin_enabled = false
    },
    {
      registry    = "ghcr.io"
      repository  = "jimmidyson/configmap-reload"
      tag         = "v0.12.0"
      pin_enabled = false
    }
  ]
}
