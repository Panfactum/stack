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
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
}

locals {
  default_resources = {
    requests = {
      memory = "100Mi"
      cpu    = "100m"
    }
    limits = {
      memory = "130Mi"
    }
  }
}

data "aws_region" "current" {}

module "util" {
  source                               = "../kube_workload_utility"
  workload_name                        = "argo-event-bus"
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  zone_anti_affinity_required          = var.enhanced_ha_enabled
  burstable_nodes_enabled              = true
  arm_nodes_enabled                    = true
  topology_spread_enabled              = true
  topology_spread_strict               = true // stateful workload

  # pf-generate: set_vars
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


// Note that ANY changes to this resource
// will cause a full recreation cycle
// due to this issue: https://github.com/argoproj/argo-events/issues/3133
// As a result, we must be EXTREMELY careful in updating this
resource "kubectl_manifest" "event_bus" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "EventBus"
    metadata = {
      name      = "default"
      namespace = var.namespace
      labels    = module.util.labels
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
          labels = module.util.labels
        }
        # This cannot be used due to this issue: https://github.com/argoproj/argo-events/issues/3134
        #startArgs = ["--tls=false"] # We don't need TLS as we have the service mesh
        persistence = {
          storageClassName = var.event_bus_storage_class_name
          volumeSize       = var.event_bus_initial_volume_size
        }

        priorityClassName = module.constants.cluster_important_priority_class_name
        tolerations       = module.util.tolerations
        affinity          = module.util.affinity
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
          resources = local.default_resources
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
          resources = local.default_resources
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
          resources = local.default_resources
        }
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true

  # TODO:
  #  wait_for {
  #    field {
  #      key = "status.conditions.[0].status"
  #      value = "True"
  #    }
  #  }
}

# TODO: PVC Autoscaling annotations


resource "kubectl_manifest" "vpa_event_bus" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "eventbus-default-js"
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "eventbus-default-js"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.event_bus]
}

resource "kubectl_manifest" "pdb_event_bus" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "eventbus-default-js"
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.event_bus]
}

