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
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

locals {
  service   = "secrets-csi"
  namespace = module.namespace.namespace
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}
module "util" {
  source                  = "../kube_workload_utility"
  workload_name           = "secrets-csi"
  burstable_nodes_enabled = true
  arm_nodes_enabled       = true

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
* Namespace
***************************************/

module "namespace" {
  source = "../kube_namespace"

  namespace      = local.service
  linkerd_inject = false // TODO: ?

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
* CSI Driver
***************************************/

resource "helm_release" "secrets_csi_driver" {
  namespace       = local.namespace
  name            = local.service
  repository      = "https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts"
  chart           = "secrets-store-csi-driver"
  version         = var.secrets_store_csi_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "secrets-csi"
      linux = {
        enabled = true
        crds = {
          enabled = true
          image = {
            repository = "${var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"}/csi-secrets-store/driver-crds"
          }
        }
        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"}/csi-secrets-store/driver"
        }
        driver = {
          resources = {
            requests = {
              memory = "100Mi"
            }
            limits = {
              memory = "130Mi"
            }
          }
        }

        registrarImage = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"}/sig-storage/csi-node-driver-registrar"
        }
        registrar = {
          resources = {
            requests = {
              memory = "100Mi"
            }
            limits = {
              memory = "130Mi"
            }
          }
        }

        livenessProbeImage = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"}/sig-storage/livenessprobe"
        }
        livenessProbe = {
          resources = {
            requests = {
              memory = "100Mi"
            }
            limits = {
              memory = "130Mi"
            }
          }
        }
        tolerations = concat(
          [
            {
              key      = "node.kubernetes.io/not-ready"
              operator = "Exists"
              effect   = "NoExecute"
            },
            {
              key      = "node.kubernetes.io/unreachable"
              operator = "Exists"
              effect   = "NoExecute"
            },
            {
              key      = "node.kubernetes.io/disk-pressure"
              operator = "Exists"
              effect   = "NoSchedule"
            },
            {
              key      = "node.kubernetes.io/memory-pressure"
              operator = "Exists"
              effect   = "NoSchedule"
            },
            {
              key      = "node.kubernetes.io/pid-pressure"
              operator = "Exists"
              effect   = "NoSchedule"
            }
          ],
          module.util.tolerations
        )

        daemonsetAnnotations = {
          "reloader.stakater.com/auto" = "true"
        }
        podAnnotations = {
          "linkerd.io/inject"                                   = "enabled"
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
        podLabels         = module.util.labels
        priorityClassName = "system-node-critical"
      }
      logVerbosity         = 2
      logFormatJSON        = true
      enableSecretRotation = true
      rotationPollInterval = "60m"
      syncSecret = {
        enabled = true
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
      name      = "secrets-csi"
      namespace = local.namespace
      labels    = module.util.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "secrets-csi"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.secrets_csi_driver]
}

resource "kubectl_manifest" "pod_monitor" {
  count = var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PodMonitor"
    metadata = {
      name      = "secrets-csi"
      namespace = local.namespace
      labels    = module.util.labels
    }
    spec = {
      podMetricsEndpoints = [{
        honorLabels = true
        interval    = "60s"
        port        = "metrics"
        scheme      = "http"
      }]
      jobLabel = "secrets-csi"
      namespaceSelector = {
        matchNames = [local.namespace]
      }
      selector = {
        matchLabels = module.util.match_labels
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.secrets_csi_driver]
}


