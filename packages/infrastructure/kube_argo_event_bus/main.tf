terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

data "aws_region" "current" {}

locals {
  event_bus_match = {
    id = random_id.event_bus_id.hex
  }
}

resource "random_id" "event_bus_id" {
  byte_length = 8
  prefix      = "argo-event-bus-"
}

module "event_bus_labels" {
  source = "../kube_labels"

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.event_bus_match)
}

module "event_bus_constants" {
  source = "../constants"

  matching_labels = local.event_bus_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.event_bus_match)
}


// Note that ANY changes to this resource
// will cause a full recreation cycle
// due to this issue: https://github.com/argoproj/argo-events/issues/3133
// As a result, we must be EXTREMELY careful in updating this
resource "kubernetes_manifest" "event_bus" {
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "EventBus"
    metadata = {
      name      = "default"
      namespace = var.namespace
      labels    = module.event_bus_labels.kube_labels
    }
    spec = {
      jetstream = {
        version  = "default"
        replicas = 3
        metadata = {
          annotations = {
            "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
            "config.linkerd.io/opaque-ports"                      = "4222,6222"
          }
          labels = module.event_bus_labels.kube_labels
        }
        # This cannot be used due to this issue: https://github.com/argoproj/argo-events/issues/3134
        #startArgs = ["--tls=false"] # We don't need TLS as we have the service mesh
        persistence = {
          storageClassName = var.event_bus_storage_class_name
          volumeSize       = var.event_bus_initial_volume_size
        }

        priorityClassName = module.event_bus_constants.cluster_important_priority_class_name
        tolerations       = module.event_bus_constants.burstable_node_toleration_helm
        # We must use this custom anti-affinity because this resource
        # does not support topologySpreadConstraints
        affinity = {
          podAntiAffinity = {
            requiredDuringSchedulingIgnoredDuringExecution = [
              {
                topologyKey = "topology.kubernetes.io/zone"
                labelSelector = {
                  matchLabels = local.event_bus_match
                }
              },
              {
                topologyKey = "node.kubernetes.io/instance-type"
                labelSelector = {
                  matchLabels = local.event_bus_match
                }
              }
            ]
          }
        }
        securityContext = {
          runAsUser  = 1001
          runAsGroup = 1001
          fsGroup    = 0 # Unfortunately, the config file is owned by root and so we must give read/write access to root-owned files
        }
        containerTemplate = {
          securityContext = {
            allowPrivilegeEscalation = false
            capabilities = {
              drop = ["ALL"]
            }
            readOnlyRootFilesystem = true
            runAsNonRoot           = true
          }
          resources = {
            requests = {
              memory = "100Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "130Mi"
            }
          }
        }
        reloaderContainerTemplate = {
          securityContext = {
            allowPrivilegeEscalation = false
            capabilities = {
              drop = ["ALL"]
              add  = ["KILL"] # Required for reloader to work as it sends SIGHUP to the main nats process
            }
            readOnlyRootFilesystem = true
            runAsNonRoot           = true
          }
          resources = {
            requests = {
              memory = "100Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "130Mi"
            }
          }
        }
        metricsContainerTemplate = {
          securityContext = {
            allowPrivilegeEscalation = false
            capabilities = {
              drop = ["ALL"]
            }
            readOnlyRootFilesystem = true
            runAsNonRoot           = true
          }
          resources = {
            requests = {
              memory = "100Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "130Mi"
            }
          }
        }
      }
    }
  }
  computed_fields = [
    "metadata.finalizers"
  ]

  wait {
    condition {
      type   = "Deployed"
      status = "True"
    }
  }
}


resource "kubernetes_manifest" "vpa_event_bus" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "eventbus-default-js"
      namespace = var.namespace
      labels    = module.event_bus_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "eventbus-default-js"
      }
    }
  }
  depends_on = [kubernetes_manifest.event_bus]
}

resource "kubernetes_manifest" "pdb_event_bus" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "eventbus-default-js"
      namespace = var.namespace
      labels    = module.event_bus_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.event_bus_match
      }
      maxUnavailable = 1
    }
  }
  depends_on = [kubernetes_manifest.event_bus]
}

