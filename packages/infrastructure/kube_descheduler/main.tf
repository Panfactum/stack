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
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

locals {
  name      = "descheduler"
  namespace = module.namespace.namespace

  default_evictor_config = {
    name = "DefaultEvictor"
    args = {
      evictSystemCriticalPods = true
      evictFailedBarePods     = true
      evictLocalStoragePods   = true
      nodeFit                 = false
    }
  }

  default_evictor_config_with_fit = {
    name = "DefaultEvictor"
    args = {
      evictSystemCriticalPods = true
      evictFailedBarePods     = true
      evictLocalStoragePods   = true
      nodeFit                 = true
    }
  }
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "util_controller" {
  source                                = "../kube_workload_utility"
  workload_name                         = "descheduler"
  burstable_nodes_enabled               = true
  instance_type_anti_affinity_preferred = true
  arm_nodes_enabled                     = true

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

  namespace = local.name

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
      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"}/descheduler/descheduler"
      }
      commonLabels         = module.util_controller.labels
      podLabels            = module.util_controller.labels
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

        profiles = [

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
                name = "RemoveDuplicates"
              },
              {
                name = "RemovePodsViolatingNodeTaints"
              }
            ]
            plugins = {
              balance = {
                enabled = [
                  "RemoveDuplicates",
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
                  maxPodLifeTimeSeconds = 60 * 3
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
                    "Job" // Jobs will be handled by the job controller
                  ]
                }
              },
              {
                name = "RemovePodsHavingTooManyRestarts"
                args = {
                  podRestartThreshold     = 5
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
                  maxPodLifeTimeSeconds = 60 * 60 * 4
                  labelSelector = {
                    matchExpressions = [{
                      key      = "panfactum.com/prevent-lifetime-eviction"
                      operator = "DoesNotExist"
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

          // Help with node consolidation
          // Doesn't work due to: https://github.com/aws/containers-roadmap/issues/1468
          #          {
          #            name = "node-consolidation"
          #            pluginConfig = [
          #              local.default_evictor_config_with_fit,
          #              {
          #                name = "HighNodeUtilization"
          #                args = {
          #                  thresholds = {
          #                    pods = 110
          #                    cpu = 35
          #                    memory = 35
          #                  }
          #                }
          #              },
          #            ]
          #            plugins = {
          #              balance = {
          #                enabled = [
          #                  "HighNodeUtilization"
          #                ]
          #              }
          #            }
          #          }
        ]
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
