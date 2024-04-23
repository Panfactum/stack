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
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "trust_manager_labels" {
  source = "../kube_labels"

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags = merge(var.extra_tags, {
    service = "${var.namespace}-trust-manager" //TODO: Make this a random ID
  })
}

module "trust_manager_constants" {
  source = "../constants"

  matching_labels = module.trust_manager_labels.kube_labels

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

/***************************************
* Trust-manager
***************************************/

resource "helm_release" "trust_manager" {
  namespace       = var.namespace
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

      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/jetstack/trust-manager"
      }

      app = {
        trust = {
          namespace = var.namespace
        }
        podLabels = module.trust_manager_labels.kube_labels
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
      }

      // Does not need to be highly available
      replicaCount      = 1
      tolerations       = module.trust_manager_constants.burstable_node_toleration_helm
      affinity          = module.trust_manager_constants.controller_node_with_burstable_affinity_helm
      priorityClassName = module.trust_manager_constants.cluster_important_priority_class_name

      resources = {
        limits = {
          memory = "100Mi"
        }
      }
    })
  ]

  // We want to use our secured internal certificate issuer
  // instead of the default self-signed one
  postrender {
    binary_path = "${path.module}/trust_manager_kustomize/kustomize.sh"
  }
}

resource "kubernetes_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "trust-manager"
      namespace = var.namespace
      labels    = module.trust_manager_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "trust-manager"
      }
    }
  }
}