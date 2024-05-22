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
  matching_labels = {
    id = random_id.controller_id.hex
  }
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

resource "random_id" "controller_id" {
  prefix      = "reflector-"
  byte_length = 8
}

module "kube_labels" {
  source = "../kube_labels"

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.matching_labels)
}

module "constants" {
  source = "../constants"

  matching_labels = local.matching_labels

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.matching_labels)
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
      podAnnotations = {
        "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
      }
      podLabels = module.kube_labels.kube_labels

      replicaCount      = 1
      tolerations       = module.constants.burstable_node_toleration_helm
      priorityClassName = module.constants.cluster_important_priority_class_name
      resources = {
        requests = {
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
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
      name      = "reflector"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "reflector"
      }
    }
  }
  depends_on = [helm_release.reflector]
}

resource "kubernetes_manifest" "pdb" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "reflector"
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
  depends_on = [helm_release.reflector]
}
