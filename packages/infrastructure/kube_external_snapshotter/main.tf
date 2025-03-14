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
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_external_snapshotter"
}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "external-snapshotter-controller"
  instance_type_anti_affinity_required = false // single instance
  az_spread_preferred                  = false // single instance
  host_anti_affinity_required          = false // single instance
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = "external-snapshotter"
}

/***************************************
* External Snapshotter
***************************************/

resource "helm_release" "external_snapshotter" {
  namespace       = local.namespace
  name            = "external-snapshotter"
  repository      = "https://piraeus.io/helm-charts"
  chart           = "snapshot-controller"
  version         = var.external_snapshotter_helm_version
  recreate_pods   = false
  atomic          = var.wait
  cleanup_on_fail = var.wait
  wait            = var.wait
  wait_for_jobs   = true
  force_update    = true
  max_history     = 5

  values = [
    yamlencode({
      controller = {
        enabled          = true
        fullnameOverride = "external-snapshotter"
        args = {
          v               = var.log_verbosity
          leader-election = true
        }
        podLabels = module.util_controller.labels

        replicaCount      = 1
        priorityClassName = module.constants.cluster_important_priority_class_name
        tolerations       = module.util_controller.tolerations

        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }
      }
    })
  ]
}

resource "kubernetes_service" "service" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name      = "external-snapshotter-controller"
    namespace = local.namespace
    labels    = module.util_controller.labels
  }
  spec {
    internal_traffic_policy = "Cluster"
    ip_families             = ["IPv4"]
    ip_family_policy        = "SingleStack"
    selector                = module.util_controller.match_labels
    port {
      name        = "http"
      port        = 8080
      protocol    = "TCP"
      target_port = "http"
    }
  }

  depends_on = [helm_release.external_snapshotter]
}

resource "kubectl_manifest" "service_monitor" {
  count = var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "external-snapshotter"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      endpoints = [{
        honorLabels = true
        interval    = "60s"
        port        = "http"
        scheme      = "http"
        path        = "/metrics"
      }]
      jobLabel = "external-snapshotter"
      namespaceSelector = {
        matchNames = [local.namespace]
      }
      selector = {
        matchLabels = module.util_controller.match_labels
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.external_snapshotter]
}


resource "kubectl_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "external-snapshotter"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
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
        name       = "external-snapshotter"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.external_snapshotter]
}

resource "kubectl_manifest" "pdb_controller" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "external-snapshotter"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_controller.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.external_snapshotter]
}


