terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.10.1"
    }
  }
}

locals {

  namespace      = "cert-manager"

}

module "trust_manager_labels" {
  source = "../kube_labels"
  additional_labels = {
    service = "${local.namespace}-trust-manager"
  }
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

module "trust_manager_constants" {
  source          = "../constants"
  matching_labels = module.trust_manager_labels.kube_labels
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* Trust-manager
***************************************/

resource "helm_release" "trust_manager" {
  namespace       = local.namespace
  name            = "trust-manager"
  repository      = "https://charts.jetstack.io"
  chart           = "trust-manager"
  version         = var.trust_manager_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      crds = {
        enabled = true
      }
      app = {
        trust = {
          namespace = local.namespace
        }
        podLabels = module.trust_manager_labels.kube_labels
      }

      // Does not need to be highly available
      replicaCount = 1
      tolerations  = module.trust_manager_constants.spot_node_toleration_helm
      affinity     = module.trust_manager_constants.controller_node_with_spot_affinity_helm
    })
  ]

  // We want to use our secured internal certificate issuer
  // instead of the default self-signed one
  postrender {
    binary_path = "${path.module}/trust_manager_kustomize/kustomize.sh"
  }
}

// TODO: Add VPA
