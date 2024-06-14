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
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
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
  source = "../kube_workload_utility"

  workload_name                         = "pvc-autoresizer"
  burstable_nodes_enabled               = true
  arm_nodes_enabled                     = false // Does not have an arm build
  panfactum_scheduler_enabled           = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_preferred = false // single copy
  topology_spread_enabled               = false // single copy

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

  namespace = "pvc-autoresizer"

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
* Autoresizer
***************************************/

resource "helm_release" "pvc_autoresizer" {
  namespace       = local.namespace
  name            = "pvc-autoresizer"
  repository      = "https://topolvm.github.io/pvc-autoresizer"
  chart           = "pvc-autoresizer"
  version         = var.pvc_autoresizer_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"}/topolvm/pvc-autoresizer"
      }
      controller = {
        args = {
          prometheusURL    = var.prometheus_enabled ? "http://thanos-query-frontend.monitoring.svc.cluster.local:9090" : null
          useK8sMetricsApi = !var.prometheus_enabled
        }
        podLabels = merge(
          module.util_controller.labels,
          {
            customizationHash = md5(join("", [
              for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
            ]))
          }
        )

        replicaCount      = 1
        priorityClassName = module.constants.cluster_important_priority_class_name
        tolerations       = module.util_controller.tolerations

        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }
      }

      podMonitor = {
        enabled   = var.monitoring_enabled
        namespace = local.namespace
        interval  = "60s"
      }

      cert-manager = {
        enabled = false // This flag actually deploys cert-manager... which is not what we want
      }
      webhook = {
        existingCertManagerIssuer = {
          group = "cert-manager.io"
          kind  = "ClusterIssuer"
          name  = "internal"
        }
      }
    })
  ]

  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
    args        = [var.panfactum_scheduler_enabled ? module.constants.panfactum_scheduler_name : "default-scheduler"]
  }
}


resource "kubectl_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "pvc-autoresizer"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "pvc-autoresizer-controller"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.pvc_autoresizer]
}

#resource "kubernetes_manifest" "vpa_webhook" {
#  count = var.vpa_enabled ? 1 : 0
#  manifest = {
#    apiVersion = "autoscaling.k8s.io/v1"
#    kind       = "VerticalPodAutoscaler"
#    metadata = {
#      name      = "external-snapshotter-webhook"
#      namespace = local.namespace
#      labels    = module.kube_labels_webhook.kube_labels
#    }
#    spec = {
#      targetRef = {
#        apiVersion = "apps/v1"
#        kind       = "Deployment"
#        name       = "external-snapshotter-webhook"
#      }
#    }
#  }
#  depends_on = [helm_release.external_snapshotter]
#}

resource "kubectl_manifest" "pdb_controller" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "pvc-autoresizer"
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
  depends_on        = [helm_release.pvc_autoresizer]
}
#
#resource "kubernetes_manifest" "pdb_webhook" {
#  manifest = {
#    apiVersion = "policy/v1"
#    kind       = "PodDisruptionBudget"
#    metadata = {
#      name      = "external-snapshotter-webhook"
#      namespace = local.namespace
#      labels    = module.kube_labels_webhook.kube_labels
#    }
#    spec = {
#      selector = {
#        matchLabels = local.webhook_match_labels
#      }
#      maxUnavailable = 1
#    }
#  }
#  depends_on = [helm_release.external_snapshotter]
#}


