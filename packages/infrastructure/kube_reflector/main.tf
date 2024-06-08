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
  workload_name                         = "reflector"
  burstable_nodes_enabled               = true
  arm_nodes_enabled                     = true
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

  namespace = "reflector"

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
* Reflector
***************************************/

resource "helm_release" "reflector" {
  namespace       = local.namespace
  name            = "reflector"
  repository      = "https://emberstack.github.io/helm-charts"
  chart           = "reflector"
  version         = var.reflector_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "reflector"
      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/emberstack/kubernetes-reflector"
      }
      configuration = {
        logging = {
          minimumLevel = var.log_level
        }
      }
      podLabels = module.util_controller.labels

      replicaCount      = 1
      tolerations       = module.util_controller.tolerations
      priorityClassName = module.constants.cluster_important_priority_class_name
      resources = {
        requests = {
          memory = "150Mi"
        }
        limits = {
          memory = "195Mi"
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
      name      = "reflector"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "reflector"
          minAllowed = {
            memory = "150Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "reflector"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.reflector]
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "reflector"
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
  depends_on        = [helm_release.reflector]
}
