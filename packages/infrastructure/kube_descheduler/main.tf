// Live

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
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
    }
  }
}

locals {
  name      = "descheduler"
  namespace = module.namespace.namespace

  exlcuded_namespaces = [
    "cilium-test" // We do not want any disruptions
  ]

  default_evictor_config = {
    name = "DefaultEvictor"
    args = {
      evictSystemCriticalPods = true
      evictFailedBarePods     = true
      evictLocalStoragePods   = true
      nodeFit                 = false
      labelSelector = {
        matchExpressions = [
          { key = "panfactum.com/descheduler-enabled", operator = "NotIn", values = ["0", "false"] }
        ]
      }
    }
  }

  default_evictor_config_with_fit = {
    name = "DefaultEvictor"
    args = {
      evictSystemCriticalPods = true
      evictFailedBarePods     = true
      evictLocalStoragePods   = true
      nodeFit                 = true
      labelSelector = {
        matchExpressions = [
          { key = "panfactum.com/descheduler-enabled", operator = "NotIn", values = ["0", "false"] }
        ]
      }
    }
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_descheduler"
}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "descheduler"
  host_anti_affinity_required          = false
  instance_type_anti_affinity_required = false
  az_spread_preferred                  = false
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

  namespace = local.name
}

/***************************************
* Descheduler
***************************************/

resource "helm_release" "descheduler" {
  namespace       = local.namespace
  name            = "descheduler"
  repository      = "https://kubernetes-sigs.github.io/descheduler/"
  chart           = "descheduler"
  version         = var.descheduler_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      cmdOptions = {
        v              = "${var.log_verbosity}"
        logging-format = "json"
      }
      kind = "Deployment"
      podLabels = merge(
        module.util_controller.labels,
        {
          customizationHash = md5(join("", [
            for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
          ]))
        }
      )
      deschedulingInterval = "5m"

      replicas    = 1
      tolerations = module.util_controller.tolerations

      resources = {
        requests = {
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
        }
      }

      service = {
        enabled = var.monitoring_enabled
      }

      serviceMonitor = {
        enabled          = var.monitoring_enabled
        namespace        = local.namespace
        additionalLabels = module.util_controller.labels
        interval         = "60s"
      }

      deschedulerPolicyAPIVersion = "descheduler/v1alpha2"
      deschedulerPolicy = {
        maxNoOfPodsToEvictPerNode      = 10
        maxNoOfPodsToEvictPerNamespace = 10

        profiles = concat(
          [

            // Evict pods violating schedule constraints
            {
              name = "scheduling-violation"
              pluginConfig = [
                local.default_evictor_config,
                {
                  name = "RemovePodsViolatingNodeAffinity"
                  args = {
                    nodeAffinityType = [
                      "requiredDuringSchedulingIgnoredDuringExecution"
                    ]
                  }
                },
                {
                  name = "RemovePodsViolatingTopologySpreadConstraint"
                  args = {
                    constraints = [
                      "DoNotSchedule",
                      "ScheduleAnyway"
                    ]
                  }
                },
                {
                  name = "RemovePodsViolatingInterPodAntiAffinity"
                },
                {
                  name = "RemovePodsViolatingNodeTaints"
                }
              ]
              plugins = {
                balance = {
                  enabled = [
                    "RemovePodsViolatingTopologySpreadConstraint"
                  ]
                }
                deschedule = {
                  enabled = [
                    "RemovePodsViolatingInterPodAntiAffinity",
                    "RemovePodsViolatingNodeAffinity",
                    "RemovePodsViolatingNodeTaints",
                  ]
                }
              }
            },

            // Evicts pods that cannot run properly
            {
              name = "pod-runtime-problems"
              pluginConfig = [
                local.default_evictor_config,
                {
                  name = "PodLifeTime"
                  args = {
                    maxPodLifeTimeSeconds = 60 * 5
                    states = [
                      "Pending",
                      "PodInitializing",
                      "ContainerCreating",
                      "ImagePullBackOff"
                    ]
                  }
                },
                {
                  name = "RemoveFailedPods"
                  args = {
                    minPodLifetimeSeconds   = 60
                    includingInitContainers = true
                    excludeOwnerKinds = [
                      "Job",     // Jobs will be handled by the job controller
                      "Workflow" // Workflow pods will be handled by argo
                    ]
                  }
                },
                {
                  name = "RemovePodsHavingTooManyRestarts"
                  args = {
                    podRestartThreshold     = 3
                    includingInitContainers = true
                  }
                }
              ]
              plugins = {
                deschedule = {
                  enabled = [
                    "PodLifeTime",
                    "RemoveFailedPods",
                    "RemovePodsHavingTooManyRestarts"
                  ]
                }
              }
            },

            // Evicts pods over a certain age
            {
              name = "pod-lifetime"
              pluginConfig = [
                local.default_evictor_config,
                {
                  name = "PodLifeTime"
                  args = {
                    maxPodLifeTimeSeconds = var.max_pod_lifetime_seconds
                    labelSelector = {
                      matchExpressions = [{
                        key      = "panfactum.com/prevent-lifetime-eviction",
                        operator = "NotIn",
                        values   = ["true", "1"]
                      }]
                    }
                  }
                },
              ]
              plugins = {
                deschedule = {
                  enabled = [
                    "PodLifeTime"
                  ]
                }
              }
            },

            // Evicts pods that have been labeled with evict
            {
              name = "pod-forced-eviction"
              pluginConfig = [
                local.default_evictor_config,
                {
                  name = "PodLifeTime"
                  args = {
                    maxPodLifeTimeSeconds = 60
                    labelSelector = {
                      matchExpressions = [{
                        key      = "panfactum.com/evict"
                        operator = "Exists"
                      }]
                    }
                  }
                },
              ]
              plugins = {
                deschedule = {
                  enabled = [
                    "PodLifeTime"
                  ]
                }
              }
            },

            // Evicts pods that have not been mutated by the standard Panfactum Kyverno policies.
            // This enables us to allow pods to be created even if Kyverno is down and then force a recreate
            // in a few minutes. Without this, a failing Kyverno deployment would take down the entire cluster.
            {
              name = "pod-lifetime-not-mutated"
              pluginConfig = [
                local.default_evictor_config,
                {
                  name = "PodLifeTime"
                  args = {
                    maxPodLifeTimeSeconds = 60 * 15
                    labelSelector = {
                      matchExpressions = [{
                        key      = "panfactum.com/kyverno-mutated",
                        operator = "NotIn",
                        values   = ["true", "1"]
                      }]
                    }
                  }
                },
              ]
              plugins = {
                deschedule = {
                  enabled = [
                    "PodLifeTime"
                  ]
                }
              }
            }
          ],
          // Note that this only works if the panfactum scheduler is enabled
          var.panfactum_scheduler_enabled ? [
            {
              name = "node-consolidation"
              pluginConfig = [
                merge(
                  local.default_evictor_config_with_fit,
                  // This ensures that this is opt-in so that we do not end up in a deschedule
                  // loop for pods that do not use the panfactum scheduler
                  {
                    labelSelector = {
                      matchLabels = {
                        "panfactum.com/scheduler" = "true"
                      }
                    }
                  }
                ),
                {
                  name = "HighNodeUtilization"
                  args = {
                    thresholds = {
                      pods   = 50
                      cpu    = 35
                      memory = 35
                    }
                    evictableNamespaces = {
                      exclude = [
                        "scheduler", # The scheduler doesn't schedule itself
                        "karpenter", # karpenter is always on the eks node pool
                      ]
                    }
                  }
                },
              ]
              plugins = {
                balance = {
                  enabled = [
                    "HighNodeUtilization"
                  ]
                }
              }
            }
          ] : []
        )
      }

      priorityClassName = module.constants.cluster_important_priority_class_name

      livenessProbe = {
        initialDelaySeconds = 20
        periodSeconds       = 10
        failureThreshold    = 3
      }
    })
  ]
}

resource "kubectl_manifest" "vpa_descheduler" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "descheduler"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "descheduler"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.descheduler]
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "descheduler"
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
  depends_on        = [helm_release.descheduler]
}
