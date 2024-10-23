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
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  namespace      = module.namespace.namespace
  webhook_secret = "kube-fledged-webhook"
  customization_hash = md5(join("", [
    for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
  ]))
}

data "pf_kube_labels" "labels" {
  module = "kube_fledged"
}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "kube-fledged-controller"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false
  az_spread_preferred                  = false
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_webhook" {
  source = "../kube_workload_utility"

  workload_name                        = "kube-fledged-webhook"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false
  az_spread_preferred                  = false
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = "kube-fledged"
}

/***************************************
* kube-fledged
***************************************/

module "webhook_cert" {
  source = "../kube_internal_cert"

  service_names = ["kube-fledged-webhook-server"]
  common_name   = "kube-fledged-webhook-server.${local.namespace}.svc"
  secret_name   = local.webhook_secret
  namespace     = local.namespace
}

resource "helm_release" "kube_fledged" {
  namespace       = local.namespace
  name            = "kubefledged-charts"
  repository      = "https://senthilrch.github.io/kubefledged-charts"
  chart           = "kube-fledged"
  version         = var.kube_fledged_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = false
  wait_for_jobs   = false
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "kube-fledged"
      args = {
        controllerImageCacheRefreshFrequency = "3m"
        controllerLogLevel                   = var.log_level
        webhookServerLogLevel                = var.log_level
        webhookServerPort                    = 8443
        webhookServerCertFile                = "/etc/webhook-certs/tls.crt"
        webhookServerKeyFile                 = "/etc/webhook-certs/tls.key"
      }
      webhookService = {
        targetPort = 8443
      }
      resources = {
        requests = {
          cpu    = "50m"
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
        }
      }
      tolerations = module.util_controller.tolerations
      affinity    = module.util_controller.affinity
      securityContext = {
        capabilities = {
          drop = ["ALL"]
        }
        readOnlyRootFilesystem = true
        runAsNonRoot           = true
        runAsUser              = 1000
      }

      ingress = {
        annotations = {
          hash = local.customization_hash # This is just used to trigger a helm re-render
        }
      }
    })
  ]

  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
    args = [
      module.util_controller.scheduler_name,
      jsonencode(module.util_controller.labels),
      jsonencode(module.util_webhook.labels)
    ]
  }

  depends_on = [module.webhook_cert]
}

resource "kubectl_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "kube-fledged-controller"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "kube-fledged-controller"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.kube_fledged]
}

resource "kubectl_manifest" "vpa_webhook" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "kube-fledged-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "kube-fledged-webhook-server"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.kube_fledged]
}
