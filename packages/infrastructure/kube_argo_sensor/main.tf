terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
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
      # We set a 2x limit here b/c losing the sensor due to an OOM can result in data loss
      memory = "200Mi"
    }
  }

  triggers = [for trigger in var.triggers :
    { for k, v in merge(
      {
        retryStrategy = {
          steps = 1
        },
        atLeastOnce = true
      },
      trigger
    ) : k => v if v != null }
  ]
}

data "aws_region" "current" {}

data "pf_kube_labels" "labels" {
  module = "kube_argo_sensor"
}

module "util" {
  source        = "../kube_workload_utility"
  workload_name = var.name

  # HA not needed b/c this can be offline for a minute or two
  # without causing any major disruptions
  host_anti_affinity_required          = false
  instance_type_anti_affinity_required = false
  az_anti_affinity_required            = false
  az_spread_preferred                  = false
  az_spread_required                   = false

  burstable_nodes_enabled  = true
  controller_nodes_enabled = true

  extra_labels = data.pf_kube_labels.labels.labels
}

#############################################################
# RBAC
#
# The Sensor is a Deployment and by default we give it permissions
# to create and access Workflow
#############################################################

resource "kubernetes_service_account" "sensor" {
  metadata {
    name      = "${var.name}-sensor"
    namespace = var.namespace
  }
}

resource "kubernetes_role" "sensor" {
  metadata {
    name      = "${var.name}-sensor"
    namespace = var.namespace
  }
  rule {
    api_groups = ["argoproj.io"]
    resources = [
      "workflows",
      "workflowtemplates",
      "clusterworkflowtemplates"
    ]
    verbs = ["*"]
  }
}

resource "kubernetes_role_binding" "sensor" {
  metadata {
    name      = "${var.name}-sensor"
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.sensor.metadata[0].name
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.sensor.metadata[0].name
    namespace = var.namespace
  }
}

#############################################################
# Sensor
#############################################################

resource "kubectl_manifest" "sensor" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Sensor"
    metadata = {
      name      = var.name
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      # Note: This is our custom enhancement to the CRD in order to get the VPA
      # to work. See https://github.com/argoproj/argo-events/issues/3180
      labelSelector = "sensor-name=${var.name},owner-name=${var.name},controller=sensor-controller"

      template = {
        metadata = {
          labels = module.util.labels
        }
        serviceAccountName = kubernetes_service_account.sensor.metadata[0].name
        tolerations        = module.util.tolerations
        affinity           = module.util.affinity
        schedulerName      = module.util.scheduler_name
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
      replicas     = 1
      eventBusName = var.event_bus_name
      dependencies = var.dependencies
      triggers     = local.triggers
    }
  })

  wait_for {
    field {
      key   = "status.conditions.[1].status" # The Deployed condition
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
      name      = "${var.name}-sensor"
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "main"
          minAllowed = {
            memory = "100Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "argoproj.io/v1alpha1"
        kind       = "Sensor"
        name       = var.name
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.sensor]
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${var.name}-sensor"
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      selector = {
        matchLabels = module.util.match_labels
      }
      # Must be minAvailable b/c this is argo Sensor CRD doesn't implement the scale subresource
      minAvailable = 0
    }
  })
  force_conflicts   = true
  server_side_apply = true
}

