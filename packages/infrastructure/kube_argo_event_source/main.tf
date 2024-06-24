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
  source        = "../kube_workload_utility"
  workload_name = var.name

  host_anti_affinity_required          = var.replicas > 1
  instance_type_anti_affinity_required = var.replicas > 1
  topology_spread_enabled              = var.replicas > 1
  topology_spread_strict               = var.replicas > 1

  burstable_nodes_enabled = true
  arm_nodes_enabled       = true

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

#############################################################
# EventSource
#############################################################

resource "kubectl_manifest" "event_source" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "EventSource"
    metadata = {
      name      = var.name
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = merge({
      # Note: This is our custom enhancement to the CRD in order to get the VPA
      # to work. See https://github.com/argoproj/argo-events/issues/3180
      labelSelector = "eventsource-name=${var.name},owner-name=${var.name},controller=eventsource-controller"

      replicas     = var.replicas
      eventBusName = var.event_bus_name

      template = {
        metadata = {
          labels = module.util.labels
        }
        tolerations = module.util.tolerations
        affinity    = module.util.affinity
        container = {
          resources = local.default_resources
          securityContext = {
            runAsUser              = 1000
            runAsGroup             = 1000
            runAsNonRoot           = true
            readOnlyRootFilesystem = true
            drop                   = ["ALL"]
          }
        }
      }

    }, var.event_source_spec)
  })

  wait_for {
    field {
      key   = "status.conditions.[0].status" # The Deployed condition
      value = "True"
    }
  }

  force_conflicts   = true
  server_side_apply = true
}

resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "${var.name}-event-source"
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      targetRef = {
        apiVersion = "argoproj.io/v1alpha1"
        kind       = "EventSource"
        name       = var.name
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.event_source]
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${var.name}-event-source"
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      selector = {
        matchLabels = module.util.match_labels
      }
      # Must be minAvailable b/c this is argo Sensor CRD doesn't implement the scale subresource
      minAvailable = var.replicas - 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
}

