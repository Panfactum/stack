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
  matching_labels = {
    id = random_id.controller_id.hex
  }
}


module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

resource "random_id" "controller_id" {
  prefix      = "reloader-"
  byte_length = 8
}

module "kube_labels" {
  source = "../kube_labels"

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = merge(var.extra_tags, local.matching_labels)
}

module "constants" {
  source = "../constants"

  matching_labels = local.matching_labels

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "namespace" {
  source = "../kube_namespace"

  namespace = "reloader"

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
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
        matchLabels            = local.matching_labels
        enableHA               = true
        deployment = {
          image = {
            name = "${var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"}/stakater/reloader"
          }
          labels = module.kube_labels.kube_labels

          replicas          = 2
          priorityClassName = module.constants.cluster_important_priority_class_name
          affinity = merge(
            module.constants.controller_node_with_burstable_affinity_helm,
            module.constants.pod_anti_affinity_helm
          )
          tolerations               = module.constants.burstable_node_toleration_helm
          topologySpreadConstraints = module.constants.topology_spread_zone_preferred

          pod = {
            annotations = {
              "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
            }
          }

          resources = {
            requests = {
              memory = "100Mi"
            }
            limits = {
              memory = "130Mi"
            }
          }
        }
        podDisruptionBudget = {
          enabled = false
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
      labels    = module.kube_labels.kube_labels
    }
    spec = {
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
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.matching_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.reloader]
}