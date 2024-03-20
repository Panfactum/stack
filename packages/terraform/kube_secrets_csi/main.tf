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

  service   = "secrets-csi"
  namespace = module.namespace.namespace

}

module "kube_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = merge(var.extra_tags, { service = local.service })
}

module "constants" {
  source         = "../constants"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source         = "../kube_namespace"
  namespace      = local.service
  linkerd_inject = false
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

/***************************************
* CSI Driver
***************************************/

resource "helm_release" "secrets_csi_driver" {
  namespace       = local.namespace
  name            = local.service
  repository      = "https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts"
  chart           = "secrets-store-csi-driver"
  version         = var.secrets_store_csi_helm_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      linux = {
        enabled = true
        crds = {
          enabled = true
        }
        daemonsetAnnotations = {
          "reloader.stakater.com/auto" = "true"
        }
        podAnnotations = {
          "linkerd.io/inject" = "enabled"
        }
        priorityClassName = "system-node-critical"
      }
      logVerbosity         = 2
      logFormatJSON        = true
      enableSecretRotation = true
      rotationPollInterval = "60m"
      syncSecret = {
        enabled = true
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
      name      = "secrets-csi-secrets-store-csi-driver"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "secrets-csi-secrets-store-csi-driver"
      }
    }
  }
}


