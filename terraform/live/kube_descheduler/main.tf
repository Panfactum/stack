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

  name      = "descheduler"
  namespace = module.namespace.namespace

}

module "kube_labels" {
  source = "../../modules/kube_labels"
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
  source          = "../../modules/constants"
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
* Namespace
***************************************/

module "namespace" {
  source            = "../../modules/kube_namespace"
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

/***************************************
* Descheduler
***************************************/

resource "helm_release" "descheduler" {
  namespace       = local.namespace
  name            = "descheduler"
  repository      = "https://kubernetes-sigs.github.io/descheduler/"
  chart           = "descheduler"
  version         = var.descheduler_helm_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      cmdOptions = {
        v = 1
      }
      kind = "Deployment"
      image = {
        tag = var.descheduler_version
      }
      commonLabels         = module.kube_labels.kube_labels
      podLabels            = module.kube_labels.kube_labels
      deschedulingInterval = "30m"

      replicas = 2
      affinity = merge(
        module.constants.controller_node_affinity_helm,
        module.constants.pod_anti_affinity_helm
      )
      leaderElection = {
        enabled = true
      }

      deschedulerPolicy = {
        maxNoOfPodsToEvictPerNode      = 10
        maxNoOfPodsToEvictPerNamespace = 10
        ignorePvcPods                  = true
        evictLocalStoragePods          = true
        strategies = {
          RemovePodsViolatingInterPodAntiAffinity = {
            enabled = true
          }
          RemovePodsViolatingNodeAffinity = {
            enabled = true
            params = {
              nodeAffinityType = [
                "requiredDuringSchedulingIgnoredDuringExecution"
              ]
            }
          }
          RemovePodsViolatingNodeTaints = {
            enabled = true
          }
          RemovePodsViolatingTopologySpreadConstraint = {
            enabled = true
            params = {
              includeSoftConstraints = true
            }
          }
          RemovePodsHavingTooManyRestarts = {
            enabled = true
            params = {
              podsHavingTooManyRestarts = {
                podRestartThreshold     = 5
                includingInitContainers = true
              }
            }
          }
          PodLifeTime = {
            enabled = true
            params = {
              podLifeTime = {
                maxPodLifeTimeSeconds = 60 * 60 * 8
              }
            }
          }
        }
      }
      priorityClassName = module.constants.cluster_important_priority_class_name

      // TODO: This is incorrect; it needs to be on the deployment,
      // but we will have to use kustomize as a variable is not exposed
      podAnnotations = {
        "reloader.stakater.com/auto" = "true"
      }
      livenessProbe = {
        initialDelaySeconds = 20
        periodSeconds       = 10
        failureThreshold    = 3
      }
    })
  ]
}

resource "kubernetes_manifest" "vpa_descheduler" {
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
  depends_on = [helm_release.descheduler]
}

resource "kubernetes_manifest" "pdb" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.name}-pdb"
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
  depends_on = [helm_release.descheduler]
}
