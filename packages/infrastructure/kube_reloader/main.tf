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
      version = "5.70.0"
    }
  }
}

locals {
  namespace = module.namespace.namespace
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util_controller" {
  source                        = "../kube_workload_utility"
  workload_name                 = "reloader"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = false // single replica
  az_spread_preferred           = false // single replica

  # pf-generate: set_vars
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

  # pf-generate: pass_vars
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
          image = {
            name = "${module.pull_through.github_registry}/stakater/reloader"
          }
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

  dynamic "postrender" {
    for_each = var.panfactum_scheduler_enabled ? ["enabled"] : []
    content {
      binary_path = "${path.module}/kustomize/kustomize.sh"
    }
  }
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
