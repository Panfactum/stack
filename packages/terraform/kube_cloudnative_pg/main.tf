// Live

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

  name      = "cloudnative-pg"
  namespace = module.namespace.namespace

}

module "kube_labels" {
  source = "../kube_labels"
  additional_labels = {
    service = local.name
  }
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

module "constants" {
  source          = "../constants"
  matching_labels = module.kube_labels.kube_labels
  app             = var.app
  environment     = var.environment
  module          = var.module
  region          = var.region
  version_tag     = var.version_tag
  version_hash    = var.version_hash
  is_local        = var.is_local
}

/***************************************
* Kubernetes Resources
***************************************/

module "namespace" {
  source            = "../kube_namespace"
  namespace         = local.name
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  app               = var.app
  environment       = var.environment
  module            = var.module
  region            = var.region
  version_tag       = var.version_tag
  version_hash      = var.version_hash
  is_local          = var.is_local
}

resource "helm_release" "cnpg" {
  namespace       = local.namespace
  name            = local.name
  repository      = "https://cloudnative-pg.github.io/charts"
  chart           = "cloudnative-pg"
  version         = var.cloudnative_pg_helm_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      fullnameOverride = local.name

      crds = {
        create = true
      }

      priorityClassName = module.constants.cluster_important_priority_class_name

      // Does not need to be highly available
      replicaCount = 2
      affinity = merge(
        module.constants.controller_node_affinity_helm,
        module.constants.pod_anti_affinity_helm
      )

      podLabels = module.kube_labels.kube_labels
      podAnnotations = {
        "reloader.stakater.com/auto" = "true"
      }

      config = {
        data = {
          INHERITED_ANNOTATIONS = "linkerd.io/*"
          INHERITED_LABELS      = "region, service, version_tag, module, app"
        }
      }
      podLabels = module.kube_labels.kube_labels
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

resource "kubernetes_manifest" "pdb" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = local.name
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = module.kube_labels.kube_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.cnpg]
}
