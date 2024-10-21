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
      version = "5.70.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_external_snapshotter"
}

module "pull_through" {
  source = "../aws_ecr_pull_through_cache_addresses"

  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "external-snapshotter-controller"
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_preferred                  = var.enhanced_ha_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_webhook" {
  source = "../kube_workload_utility"

  workload_name                        = "external-snapshotter-webhook"
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_preferred                  = var.enhanced_ha_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = "external-snapshotter"
}

/***************************************
* External Snapshotter
***************************************/

module "webhook_cert" {
  source = "../kube_internal_cert"

  service_names = ["external-snapshotter-webhook"]
  secret_name   = "external-snapshotter-webhook-certs"
  namespace     = local.namespace
}

resource "helm_release" "external_snapshotter" {
  namespace       = local.namespace
  name            = "external-snapshotter"
  repository      = "https://piraeus.io/helm-charts"
  chart           = "snapshot-controller"
  version         = var.external_snapshotter_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      controller = {
        enabled          = true
        fullnameOverride = "external-snapshotter"
        image = {
          repository = "${module.pull_through.kubernetes_registry}/sig-storage/snapshot-controller"
        }
        args = {
          v               = var.log_verbosity
          leader-election = true
        }
        podLabels = module.util_controller.labels
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }

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

      webhook = {
        enabled          = true
        fullnameOverride = "external-snapshotter-webhook"
        image = {
          repository = "${module.pull_through.kubernetes_registry}/sig-storage/snapshot-validation-webhook"
        }
        args = {
          v = var.log_verbosity
        }
        podLabels = merge(
          module.util_webhook.labels,
          {
            customizationHash = md5(join("", [for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)]))
          }
        )
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }

        replicaCount              = 2
        priorityClassName         = module.constants.cluster_important_priority_class_name
        tolerations               = module.util_webhook.tolerations
        affinity                  = module.util_webhook.affinity
        topologySpreadConstraints = module.util_webhook.topology_spread_constraints


        tls = {
          certificateSecret = module.webhook_cert.secret_name
          autogenerate      = false
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
    })
  ]

  // Injects the CA data into the webhook manifest
  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
    args        = [var.panfactum_scheduler_enabled ? module.constants.panfactum_scheduler_name : "default-scheduler"]
  }

  depends_on = [module.webhook_cert]
}

resource "kubernetes_service" "service" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name      = "external-snapshotter-controller"
    namespace = local.namespace
    labels    = module.util_controller.labels
  }
  spec {
    internal_traffic_policy = "Cluster"
    ip_families             = ["IPv4"]
    ip_family_policy        = "SingleStack"
    selector                = module.util_controller.match_labels
    port {
      name        = "http"
      port        = 8080
      protocol    = "TCP"
      target_port = "http"
    }
  }

  depends_on = [helm_release.external_snapshotter]
}

resource "kubectl_manifest" "service_monitor" {
  count = var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "external-snapshotter"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      endpoints = [{
        honorLabels = true
        interval    = "60s"
        port        = "http"
        scheme      = "http"
        path        = "/metrics"
      }]
      jobLabel = "external-snapshotter"
      namespaceSelector = {
        matchNames = [local.namespace]
      }
      selector = {
        matchLabels = module.util_controller.match_labels
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.external_snapshotter]
}


resource "kubectl_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "external-snapshotter"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "external-snapshotter"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.external_snapshotter]
}

resource "kubectl_manifest" "vpa_webhook" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "external-snapshotter-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "external-snapshotter-webhook"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.external_snapshotter]
}

resource "kubectl_manifest" "pdb_controller" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "external-snapshotter"
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
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.external_snapshotter]
}

resource "kubectl_manifest" "pdb_webhook" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "external-snapshotter-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_webhook.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.external_snapshotter]
}


