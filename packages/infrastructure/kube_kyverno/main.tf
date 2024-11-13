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
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
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
  name      = "kyverno"
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_kyverno"
}

module "util_crd_migrate" {
  source = "../kube_workload_utility"

  workload_name               = "kyverno-crd-migrate"
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  az_spread_preferred         = var.enhanced_ha_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  extra_labels                = data.pf_kube_labels.labels.labels
}

module "util_admission_controller" {
  source = "../kube_workload_utility"

  workload_name               = "kyverno-admission-controller"
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  extra_labels                = data.pf_kube_labels.labels.labels

  # This controller is critical to launching all pods so it cannot go down
  az_spread_required                   = true
  instance_type_anti_affinity_required = false // TODO: Make true but needs to be compatible with bootstrapping
}

module "util_background_controller" {
  source = "../kube_workload_utility"

  workload_name               = "kyverno-background-controller"
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  az_spread_preferred         = var.enhanced_ha_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  extra_labels                = data.pf_kube_labels.labels.labels
}

module "util_cleanup_controller" {
  source = "../kube_workload_utility"

  workload_name               = "kyverno-cleanup-controller"
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  az_spread_preferred         = var.enhanced_ha_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  extra_labels                = data.pf_kube_labels.labels.labels
}

module "util_reports_controller" {
  source = "../kube_workload_utility"

  workload_name               = "kyverno-reports-controller"
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  az_spread_preferred         = var.enhanced_ha_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  extra_labels                = data.pf_kube_labels.labels.labels
}

module "util_webhooks_cleanup" {
  source = "../kube_workload_utility"

  workload_name               = "kyverno-webhooks-cleanup"
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  az_spread_preferred         = var.enhanced_ha_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  extra_labels                = data.pf_kube_labels.labels.labels
}

module "util_policy_reports_cleanup" {
  source = "../kube_workload_utility"

  workload_name               = "kyverno-policy-reports-cleanup"
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  az_spread_preferred         = var.enhanced_ha_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  extra_labels                = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name
}

/**************************************************************************
  Maintainer Notes:

  1. It doesn't appear possible to supply our own certs for the webhooks. Following
  their guide creates an error.
 */

resource "helm_release" "kyverno" {
  namespace       = local.namespace
  name            = local.name
  repository      = "https://kyverno.github.io/kyverno"
  chart           = local.name
  version         = var.kyverno_helm_version
  recreate_pods   = false
  force_update    = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = local.name

      crds = {
        install = true
        migrations = {
          enabled     = true
          tolerations = module.util_crd_migrate.tolerations
          podLabels   = module.util_crd_migrate.labels
        }
      }

      features = {
        logging = {
          format    = "json"
          verbosity = var.log_level
        }
      }

      config = {
        resourceFilters = [
          "[Event,*,*]",
          "[*/*,kube-public,*]",
          "[*/*,kube-node-lease,*]",
          "[Node,*,*]",
          "[Node/*,*,*]",
          "[APIService,*,*]",
          "[APIService/*,*,*]",
          "[TokenReview,*,*]",
          "[SubjectAccessReview,*,*]",
          "[SelfSubjectAccessReview,*,*]",
          "[Binding,*,*]",
          "[Pod/binding,*,*]",
          "[ReplicaSet,*,*]",
          "[ReplicaSet/*,*,*]",
          "[EphemeralReport,*,*]",
          "[ClusterEphemeralReport,*,*]",
        ]
        webhooks = [{
          namespaceSelector = {}
        }]
        excludeKyvernoNamespace = false
      }

      admissionController = {
        replicas          = 2
        podLabels         = module.util_admission_controller.labels
        tolerations       = module.util_admission_controller.tolerations
        priorityClassName = "system-node-critical" // DaemonSet pods cannot be scheduled without this running, so it should be the most critical
        updateStrategy = {
          rollingUpdate = {
            maxSurge       = 0 // Prefer not to surge since instance-type spread is required
            maxUnavailable = 1
          }
          type = "RollingUpdate"
        }

        apiPriorityAndFairness = true // Ensures stability on busy clusters

        antiAffinity = {
          enabled = true
        }

        podAntiAffinity           = lookup(module.util_admission_controller.affinity, "podAntiAffinity", null)
        nodeAffinity              = lookup(module.util_admission_controller.affinity, "nodeAffinity", null)
        topologySpreadConstraints = module.util_admission_controller.topology_spread_constraints

        podDisruptionBudget = {
          enabled = false // We do this on our own
        }

        initContainer = {
          resources = {
            requests = {
              cpu    = "10m"
              memory = "64Mi"
            }
            limits = {
              memory = "128Mi"
            }
          }
        }
        container = {
          resources = {
            requests = {
              cpu    = "100m"
              memory = "100Mi"
            }
            limits = {
              memory = "130Mi"
            }
          }
        }
        networkPolicy = {
          enabled = false
        }
        tracing = {
          enabled = false
        }
        metering = {
          enabled = false
        }
        profiling = {
          enabled = false
        }
      }

      backgroundController = {
        replicas    = 1 # HA isn't necessary for this
        podLabels   = module.util_background_controller.labels
        tolerations = module.util_background_controller.tolerations

        antiAffinity = {
          enabled = true
        }

        podAntiAffinity           = lookup(module.util_background_controller.affinity, "podAntiAffinity", null)
        nodeAffinity              = lookup(module.util_background_controller.affinity, "nodeAffinity", null)
        topologySpreadConstraints = module.util_background_controller.topology_spread_constraints

        podDisruptionBudget = {
          enabled = false // We do this on our own
        }

        resources = {
          requests = {
            cpu    = "100m"
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }

        networkPolicy = {
          enabled = false
        }
        tracing = {
          enabled = false
        }
        metering = {
          enabled = false
        }
        profiling = {
          enabled = false
        }
      }

      cleanupController = {
        replicas          = 2
        podLabels         = module.util_cleanup_controller.labels
        tolerations       = module.util_cleanup_controller.tolerations
        priorityClassName = "system-cluster-critical"

        antiAffinity = {
          enabled = true
        }

        podAntiAffinity           = lookup(module.util_cleanup_controller.affinity, "podAntiAffinity", null)
        nodeAffinity              = lookup(module.util_cleanup_controller.affinity, "nodeAffinity", null)
        topologySpreadConstraints = module.util_cleanup_controller.topology_spread_constraints

        podDisruptionBudget = {
          enabled = false // We do this on our own
        }

        resources = {
          requests = {
            cpu    = "100m"
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }
        networkPolicy = {
          enabled = false
        }
        tracing = {
          enabled = false
        }
        metering = {
          enabled = false
        }
        profiling = {
          enabled = false
        }
      }

      reportsController = {
        replicas    = 1 # HA isn't necessary for this
        podLabels   = module.util_reports_controller.labels
        tolerations = module.util_reports_controller.tolerations

        antiAffinity = {
          enabled = true
        }

        podAntiAffinity           = lookup(module.util_reports_controller.affinity, "podAntiAffinity", null)
        nodeAffinity              = lookup(module.util_reports_controller.affinity, "nodeAffinity", null)
        topologySpreadConstraints = module.util_reports_controller.topology_spread_constraints

        podDisruptionBudget = {
          enabled = false // We do this on our own
        }

        resources = {
          requests = {
            cpu    = "100m"
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }

        networkPolicy = {
          enabled = false
        }
        tracing = {
          enabled = false
        }
        metering = {
          enabled = false
        }
        profiling = {
          enabled = false
        }
      }

      webhooksCleanup = {
        enabled     = true
        tolerations = module.util_webhooks_cleanup.tolerations
        podLabels   = module.util_webhooks_cleanup.labels
      }

      policyReportsCleanup = {
        enabled     = true
        tolerations = module.util_policy_reports_cleanup.tolerations
        podLabels   = module.util_policy_reports_cleanup.labels
      }
    })
  ]
}

resource "kubernetes_cluster_role" "extra_background_controller" {
  metadata {
    name = "kyverno:extra-background-controller"
    labels = merge(data.pf_kube_labels.labels.labels, {
      "app.kubernetes.io/part-of"   = "kyverno"
      "app.kubernetes.io/instance"  = "kyverno"
      "app.kubernetes.io/component" = "background-controller"
    })
  }
  rule {
    api_groups = [""]
    verbs      = ["create", "update", "delete"]
    resources  = ["configmaps", "secrets"]
  }
}

resource "kubernetes_cluster_role" "extra_admission_controller" {
  metadata {
    name = "kyverno:extra-admission-controller"
    labels = merge(data.pf_kube_labels.labels.labels, {
      "app.kubernetes.io/part-of"   = "kyverno"
      "app.kubernetes.io/instance"  = "kyverno"
      "app.kubernetes.io/component" = "admission-controller"
    })
  }
  rule {
    api_groups = [""]
    verbs      = ["create", "update", "delete"]
    resources  = ["configmaps", "secrets"]
  }
}

# Cannot deploy due to: https://github.com/kyverno/kyverno/issues/11469
# resource "kubectl_manifest" "pdb_admission_controller" {
#   yaml_body = yamlencode({
#     apiVersion = "policy/v1"
#     kind       = "PodDisruptionBudget"
#     metadata = {
#       name      = "kyverno-admission-controller"
#       namespace = local.namespace
#       labels    = module.util_admission_controller.labels
#     }
#     spec = {
#       unhealthyPodEvictionPolicy = "AlwaysAllow"
#       selector = {
#         matchLabels = module.util_admission_controller.match_labels
#       }
#       maxUnavailable = 1
#     }
#   })
#   server_side_apply = true
#   force_conflicts   = true
#   depends_on        = [helm_release.kyverno]
# }

resource "kubectl_manifest" "pdb_background_controller" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "kyverno-background-controller"
      namespace = local.namespace
      labels    = module.util_background_controller.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_background_controller.match_labels
      }
      maxUnavailable = 1
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.kyverno]
}

# Cannot deploy due to: https://github.com/kyverno/kyverno/issues/11469
# resource "kubectl_manifest" "pdb_cleanup_controller" {
#   yaml_body = yamlencode({
#     apiVersion = "policy/v1"
#     kind       = "PodDisruptionBudget"
#     metadata = {
#       name      = "kyverno-cleanup-controller"
#       namespace = local.namespace
#       labels    = module.util_cleanup_controller.labels
#     }
#     spec = {
#       unhealthyPodEvictionPolicy = "AlwaysAllow"
#       selector = {
#         matchLabels = module.util_cleanup_controller.match_labels
#       }
#       maxUnavailable = 1
#     }
#   })
#   server_side_apply = true
#   force_conflicts   = true
#   depends_on        = [helm_release.kyverno]
# }

resource "kubectl_manifest" "pdb_reports_controller" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "kyverno-reports-controller"
      namespace = local.namespace
      labels    = module.util_reports_controller.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_reports_controller.match_labels
      }
      maxUnavailable = 1
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.kyverno]
}

resource "kubectl_manifest" "vpa_admission_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "kyverno-admission-controller"
      namespace = local.namespace
      labels    = module.util_admission_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "kyverno-admission-controller"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.kyverno]
}

resource "kubectl_manifest" "vpa_background_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "kyverno-background-controller"
      namespace = local.namespace
      labels    = module.util_background_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "kyverno-background-controller"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.kyverno]
}


resource "kubectl_manifest" "vpa_cleanup_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "kyverno-cleanup-controller"
      namespace = local.namespace
      labels    = module.util_cleanup_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "kyverno-cleanup-controller"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.kyverno]
}


resource "kubectl_manifest" "vpa_reports_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "kyverno-reports-controller"
      namespace = local.namespace
      labels    = module.util_reports_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "kyverno-reports-controller"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.kyverno]
}
