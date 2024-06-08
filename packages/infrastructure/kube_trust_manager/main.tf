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

module "util" {
  source                                = "../kube_workload_utility"
  workload_name                         = "trust-manager"
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

/***************************************
* Trust-manager
***************************************/

resource "helm_release" "trust_manager" {
  namespace       = var.namespace
  name            = "trust-manager"
  repository      = "https://charts.jetstack.io"
  chart           = "trust-manager"
  version         = var.trust_manager_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      crds = {
        enabled = true
      }

      commonLabels = module.util.labels

      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/jetstack/trust-manager"
      }

      app = {
        trust = {
          namespace = var.namespace
        }

        metrics = {
          service = {
            enabled = var.monitoring_enabled
            servicemonitor = {
              enabled  = var.monitoring_enabled
              interval = "60s"
            }
          }
        }
      }

      // Does not need to be highly available
      replicaCount      = 1
      tolerations       = module.util.tolerations
      affinity          = module.util.affinity
      priorityClassName = module.constants.cluster_important_priority_class_name

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
      labels    = module.util.labels
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
