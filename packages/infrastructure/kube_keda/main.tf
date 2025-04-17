// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  name         = "keda"
  namespace    = module.namespace.namespace
  cluster_name = data.pf_metadata.metadata.kube_cluster_name
}

data "aws_region" "main" {}
data "aws_caller_identity" "main" {}

data "pf_kube_labels" "labels" {
  module = "kube_keda"
}

data "pf_metadata" "metadata" {}

module "util_operator" {
  source = "../kube_workload_utility"

  workload_name                        = "keda-operator"
  az_spread_preferred                  = var.sla_target >= 2
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_webhook" {
  source = "../kube_workload_utility"

  workload_name                        = "keda-webhooks"
  az_spread_preferred                  = var.sla_target >= 2
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_metrics_server" {
  source = "../kube_workload_utility"

  workload_name                        = "keda-metrics-server"
  az_spread_preferred                  = var.sla_target >= 2
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name
}

resource "kubectl_manifest" "cert_fixup" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "Policy"
    metadata = {
      name      = "keda-cert-adjustments"
      namespace = local.name
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      useServerSideApply = true
      rules = [
        {
          name = "fix-algo"
          match = {
            resources = {
              kinds = ["cert-manager.io/v1/Certificate"]
              names = ["keda-*"]
            }
          }
          mutate = {
            patchStrategicMerge = {
              spec = {
                privateKey = {
                  algorithm      = "ECDSA",
                  size           = 256
                  rotationPolicy = "Always"
                }
              }
            }
          }
        }
      ]
    }
  })
  force_conflicts   = true
  server_side_apply = true
}

resource "helm_release" "keda" {
  namespace       = local.namespace
  name            = "keda"
  repository      = "https://kedacore.github.io/charts"
  chart           = "keda"
  version         = var.keda_helm_version
  recreate_pods   = false
  atomic          = var.wait
  cleanup_on_fail = var.wait
  wait            = var.wait
  wait_for_jobs   = true
  force_update    = true
  skip_crds       = true # managed above
  max_history     = 5

  values = [
    yamlencode({
      nameOverride     = local.name
      fullnameOverride = local.name
      additionalLabels = data.pf_kube_labels.labels.labels
      asciiArt         = false

      crds = {
        install = true
      }

      clusterName = data.pf_metadata.metadata.kube_cluster_name

      env = [
        {
          name  = "KEDA_SCALEDOBJECT_CTRL_MAX_RECONCILES"
          value = tostring(var.scaled_object_max_concurrent_reconciles)
        },
        {
          name  = "KEDA_SCALEDJOB_CTRL_MAX_RECONCILES"
          value = tostring(var.scaled_job_max_concurrent_reconciles)
        }
      ]

      certificates = {
        autoGenerated = true
        certManager = {
          enabled     = true
          duration    = "${24 * 14}h0m0s"
          renewBefore = "${24 * 7}h0m0s"
          generateCA  = false
          issuer = {
            generate = false
            group    = "cert-manager.io"
            kind     = "ClusterIssuer",
            name     = "internal"
          }
          secretTemplate = {
            annotations = {
              // This allows for the secret to have its ca data directly injected into webhooks
              "cert-manager.io/allow-direct-injection" = "true"
            }
          }
        }
      }

      rbac = {
        // Needs to edit configmap in kube-system to register self as APIService
        controlPlaneServiceAccountsNamespace = "kube-system"
      }

      tolerations = module.util_operator.tolerations

      podLabels = {
        keda           = module.util_operator.labels
        webhooks       = module.util_webhook.labels
        metricsAdapter = module.util_metrics_server.labels
      }

      logging = {
        webhooks = {
          format = "json"
          level  = var.log_level
        }
        operator = {
          format = "json"
          level  = var.log_level
        }
        metricsApiServer = {
          level = var.log_level == "error" ? 0 : var.log_level == "info" ? 1 : 5
        }
      }

      resources = {
        webhooks = {
          requests = {
            cpu    = "10m"
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
            cpu    = null
          }
        }
        metricServer = {
          requests = {
            cpu    = "10m"
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
            cpu    = null
          }
        }
        operator = {
          requests = {
            cpu    = "10m"
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
            cpu    = null
          }
        }
      }

      topologySpreadConstraints = {
        webhooks      = module.util_webhook.topology_spread_constraints
        metricsServer = module.util_metrics_server.topology_spread_constraints
        operator      = module.util_operator.topology_spread_constraints
      }
      updateStrategy = {
        webhooks = {
          type = "RollingUpdate"
          rollingUpdate = {
            maxSurge       = 0
            maxUnavailable = 1
          }
        }
        metricsApiServer = {
          type = "RollingUpdate"
          rollingUpdate = {
            maxSurge       = var.sla_target >= 2 ? 0 : 1
            maxUnavailable = var.sla_target >= 2 ? 1 : 0
          }
        }
        operator = {
          type = "Recreate"
        }
      }

      operator = {
        name                 = "keda-operator"
        replicaCount         = 1
        affinity             = module.util_operator.affinity
        revisionHistoryLimit = 5
      }
      metricsServer = {
        replicaCount         = var.sla_target >= 2 ? 2 : 1
        affinity             = module.util_metrics_server.affinity
        revisionHistoryLimit = 5
      }

      webhooks = {
        name                 = "keda-webhooks"
        enabled              = true
        failurePolicy        = "Fail"
        replicaCount         = 2 // Always needs to be 2 since failure policy is Fail
        affinity             = module.util_webhook.affinity
        revisionHistoryLimit = 5
      }
    })
  ]

  timeout    = 300
  depends_on = [kubectl_manifest.cert_fixup]
}

resource "kubectl_manifest" "vpa_operator" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "keda-operator"
      namespace = local.namespace
      labels    = module.util_operator.labels
    }
    spec = {
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "keda-operator"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.keda]
}


resource "kubectl_manifest" "vpa_metrics_server" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "keda-metrics-server"
      namespace = local.namespace
      labels    = module.util_metrics_server.labels
    }
    spec = {
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "keda-operator-metrics-apiserver"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.keda]
}

resource "kubectl_manifest" "vpa_webhooks" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "keda-webhooks"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "keda-webhooks"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.keda]
}

resource "kubectl_manifest" "pdb_operator" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "keda-operator"
      namespace = local.namespace
      labels    = module.util_operator.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_operator.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.keda]
}

resource "kubectl_manifest" "pdb_metrics_server" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "keda-metrics-server"
      namespace = local.namespace
      labels    = module.util_metrics_server.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_metrics_server.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.keda]
}

resource "kubectl_manifest" "pdb_webhooks" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "keda-webhooks"
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
  depends_on        = [helm_release.keda]
}