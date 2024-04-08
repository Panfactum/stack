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
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "kube_labels" {
  source = "../kube_labels"

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "constants" {
  source = "../constants"

  matching_labels = module.kube_labels.kube_labels

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
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
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

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
      commonLabels = module.kube_labels.kube_labels
      podLabels    = module.kube_labels.kube_labels
      podAnnotations = {
        "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
      }
      deschedulingInterval = "5m"

      replicas = 2
      leaderElection = {
        enabled = true
      }
      affinity = merge(
        module.constants.controller_node_with_burstable_affinity_helm,
        module.constants.pod_anti_affinity_helm
      )
      tolerations = module.constants.burstable_node_toleration_helm

      resources = {
        requests = {
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
        }
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

resource "kubernetes_manifest" "vpa_descheduler" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "descheduler"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "descheduler"
      }
    }
  }
  depends_on = [helm_release.descheduler]
}

resource "kubernetes_manifest" "pdb" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "descheduler"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = module.kube_labels.kube_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.descheduler]
}
