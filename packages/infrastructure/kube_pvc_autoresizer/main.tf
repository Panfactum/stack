terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_pvc_autoresizer"
}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "pvc-autoresizer"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.sla_target == 3
  az_spread_preferred                  = var.sla_target >= 2
  host_anti_affinity_required          = var.sla_target >= 2
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = "pvc-autoresizer"
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
  atomic          = true
  force_update    = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      image = {
        repository = "public.ecr.aws/t8f0s7h5/pvc-autoresizer"
        tag        = var.pvc_autoresizer_version
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

        replicas          = var.sla_target >= 2 ? 2 : 1
        priorityClassName = module.constants.cluster_important_priority_class_name
        tolerations       = module.util_controller.tolerations
        affinity          = module.util_controller.affinity

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
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resource          = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
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


