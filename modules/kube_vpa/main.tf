terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.10.1"
    }
  }
}

locals {

  name      = "vertical-pod-autoscaler"
  namespace = module.namespace.namespace

  environment = var.environment
  module      = var.module
  version     = var.version_tag

  labels = merge(var.kube_labels, {
    service = local.name
  })

  webhook_secret = "va-webhook-certs"
}

module "constants" {
  source = "../constants"
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

# ################################################################################
# Namespace
# ################################################################################

module "namespace" {
  source            = "../kube_namespace"
  namespace         = local.name
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  kube_labels       = local.labels
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

# ################################################################################
# Vertical Autoscaler
# ################################################################################

module "webhook_cert" {
  source        = "../kube_internal_cert"
  service_names = ["vertical-pod-autoscaler-vpa-webhook"]
  secret_name   = local.webhook_secret
  namespace     = local.namespace
  labels        = local.labels
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

resource "helm_release" "vpa" {
  namespace       = local.namespace
  name            = local.name
  repository      = "https://charts.fairwinds.com/stable"
  chart           = "vpa"
  version         = var.vertical_autoscaler_helm_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({

      podLabels = merge(local.labels, {
        customizationHash = md5(join("", [for filename in fileset(path.module, "vpa_kustomize/*") : filesha256(filename)]))
      })

      priorityClassName = "system-cluster-critical"

      recommender = {
        // ONLY 1 of these should be running at a time
        // b/c there is no leader-election: https://github.com/kubernetes/autoscaler/issues/5481
        // However, that creates a potential issue with memory consumption as if this pod
        // OOMs, then it won't be recorded and then bumped up. As a result, we have to tune this
        // pods memory floor carefully and give it plenty of headroom.
        replicaCount = 1
        affinity = merge({
          podAntiAffinity = {
            requiredDuringSchedulingIgnoredDuringExecution = [{
              labelSelector = {
                matchLabels = {
                  "app.kubernetes.io/name"      = "vpa"
                  "app.kubernetes.io/component" = "recommender"
                }
              }
              topologyKey : "kubernetes.io/hostname"
            }]
          }
        }, module.constants.controller_node_affinity_helm)

        extraArgs = {
          // Better packing
          "pod-recommendation-min-cpu-millicores" = 2
          "pod-recommendation-min-memory-mb"      = 10

          // Lower half-life so we have better intra-day scaling
          "cpu-histogram-decay-half-life"    = "2h0m0s"
          "memory-histogram-decay-half-life" = "2h0m0s"

          v = 2
        }
      }


      updater = {
        // ONLY 1 of these should be running at a time
        // b/c there is no leader-election: https://github.com/kubernetes/autoscaler/issues/5481
        replicaCount = 1
        affinity = merge({
          podAntiAffinity = {
            requiredDuringSchedulingIgnoredDuringExecution = [{
              labelSelector = {
                matchLabels = {
                  "app.kubernetes.io/name"      = "vpa"
                  "app.kubernetes.io/component" = "updater"
                }
              }
              topologyKey : "kubernetes.io/hostname"
            }]
          }
        }, module.constants.controller_node_affinity_helm)

        extraArgs = {
          "min-replicas" = 0 // We don't care b/c we use pdbs
          v              = 2
        }
      }

      admissionController = {
        // We do need at least 2 otherwise we may get stuck in a loop
        // b/c if this pod goes down, it cannot apply the appropriate
        // resource requirements when it comes back up and then the
        // updater will take it down again
        replicaCount = 2
        affinity = merge({
          podAntiAffinity = {
            requiredDuringSchedulingIgnoredDuringExecution = [{
              labelSelector = {
                matchLabels = {
                  "app.kubernetes.io/name"      = "vpa"
                  "app.kubernetes.io/component" = "admission-controller"
                }
              }
              topologyKey : "kubernetes.io/hostname"
            }]
          }
        }, module.constants.controller_node_affinity_helm)

        podDisruptionBudget = {
          minAvailable = 1
        }

        // We will use our own secret
        generateCertificate = false
        secretName          = local.webhook_secret
        extraArgs = {
          client-ca-file  = "/etc/tls-certs/ca.crt"
          tls-cert-file   = "/etc/tls-certs/tls.crt"
          tls-private-key = "/etc/tls-certs/tls.key"
          v               = "2"
        }
        mutatingWebhookConfiguration = {
          annotations = {
            "cert-manager.io/inject-ca-from" = "${local.namespace}/${local.webhook_secret}"
          }
        }
      }
    })
  ]

  // We need to add the reloader annotation to the admission controller deployment
  // so that it restarts when the webhook cert is rotated
  postrender {
    binary_path = "${path.module}/vpa_kustomize/kustomize.sh"
  }

  depends_on = [module.webhook_cert]
}

/***************************************
* VPA Resources
***************************************/

resource "kubernetes_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vertical-pod-autoscaler-vpa-admission-controller"
      namespace = local.namespace
      labels    = local.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "vertical-pod-autoscaler-vpa-admission-controller"
      }
    }
  }
}

resource "kubernetes_manifest" "vpa_recommender" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vertical-pod-autoscaler-vpa-recommender"
      namespace = local.namespace
      labels    = local.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "vpa"
          minAllowed = {
            memory = "100Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "vertical-pod-autoscaler-vpa-recommender"
      }
    }
  }
}

resource "kubernetes_manifest" "vpa_updater" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vertical-pod-autoscaler-vpa-updater"
      namespace = local.namespace
      labels    = local.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "vertical-pod-autoscaler-vpa-updater"
      }
    }
  }
}
