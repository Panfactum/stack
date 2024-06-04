terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

locals {
  namespace = module.namespace.namespace
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "util_controller" {
  source                                = "../kube_workload_utility"
  workload_name                         = "reloader"
  burstable_nodes_enabled               = true
  instance_type_anti_affinity_preferred = true

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

module "namespace" {
  source = "../kube_namespace"

  namespace = "reloader"

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

  values = [
    yamlencode({
      fullnameOverride = "reloader"
      reloader = {
        autoReloadAll          = true
        reloadStrategy         = "annotations"
        logFormat              = "json"
        readOnlyRootFilesystem = true
        matchLabels            = module.util_controller.match_labels
        enableHA               = false
        deployment = {
          image = {
            name = "${var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"}/stakater/reloader"
          }
          labels = module.util_controller.labels

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

resource "kubernetes_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
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
  }
  depends_on = [helm_release.reloader]
}

resource "kubernetes_manifest" "pdb" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "reloader"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      selector = {
        matchLabels = module.util_controller.match_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.reloader]
}
