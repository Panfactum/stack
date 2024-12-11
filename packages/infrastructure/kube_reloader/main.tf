terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.4"
    }
  }
}

locals {
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_reloader"
}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "reloader"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false // single replica
  az_spread_preferred                  = false // single replica
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = "reloader"
}

/***************************************
* Reloader
***************************************/

resource "helm_release" "reloader" {
  namespace       = local.namespace
  name            = "reloader"
  repository      = "https://stakater.github.io/stakater-charts"
  chart           = "reloader"
  version         = var.reloader_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "reloader"
      reloader = {
        autoReloadAll          = true
        reloadStrategy         = "annotations"
        reloadOnCreate         = true
        logFormat              = "json"
        readOnlyRootFilesystem = true
        matchLabels            = module.util_controller.match_labels
        enableHA               = false
        deployment = {
          labels = merge(
            { for k, v in module.util_controller.labels : k => v if k != "id" }, # id gets duplicated by matchLabels and breaks kustomize
            {
              customizationHash = md5(join("", [
                for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
              ]))
            }
          )

          replicas          = 1
          priorityClassName = module.constants.cluster_important_priority_class_name
          tolerations       = module.util_controller.tolerations

          resources = {
            requests = {
              memory = "200Mi"
            }
            limits = {
              memory = "260Mi"
            }
          }
        }
        podDisruptionBudget = {
          enabled = false
        }
        podMonitor = {
          enabled = var.monitoring_enabled
        }
      }
    })
  ]
}

resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "reloader"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "reloader"
          minAllowed = {
            memory = "200Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "reloader"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.reloader]
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "reloader"
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
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.reloader]
}
