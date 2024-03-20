// Live

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
  }
}

locals {

  name      = "metrics-server"
  namespace = module.namespace.namespace

}

module "kube_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags = merge(var.extra_tags, {
    service = local.name
  })
}

module "constants" {
  source = "../constants"
  matching_labels = {
    "app.kubernetes.io/name" = "metrics-server"
  }
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

/***************************************
* Kubernetes Resources
***************************************/

module "namespace" {
  source         = "../kube_namespace"
  namespace      = local.name
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

resource "helm_release" "metrics_server" {
  namespace       = local.namespace
  name            = "metrics-server"
  repository      = "https://kubernetes-sigs.github.io/metrics-server/"
  chart           = "metrics-server"
  version         = var.metrics_server_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      image = {
        repository = "registry.k8s.io/metrics-server/metrics-server"
        tag        = var.metrics_server_version
      }
      commonLabels = module.kube_labels.kube_labels
      podLabels    = module.kube_labels.kube_labels

      deploymentAnnotations = {
        "reloader.stakater.com/auto" = "true"
      }
      priorityClassName = "system-cluster-critical"

      // Should be highly available
      replicas = 2
      affinity = merge(
        module.constants.controller_node_affinity_helm,
        module.constants.pod_anti_affinity_helm
      )

      podDisruptionBudget = {
        enabled      = true
        minAvailable = 1
      }

      args = ["--v=0"]
      livenessProbe = {
        initialDelaySeconds = 20
        periodSeconds       = 10
        failureThreshold    = 3
      }
      readinessProbe = {
        initialDelaySeconds = 20
        periodSeconds       = 10
        failureThreshold    = 1
      }
    })
  ]
}

resource "kubernetes_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = local.name
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = local.name
      }
    }
  }
}
