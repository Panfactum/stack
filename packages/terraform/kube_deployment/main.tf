// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
  }
}

module "kube_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags = merge(var.extra_tags, {
    service = var.service_name
  })
}

module "pod_template" {
  source       = "../kube_pod"
  allowed_spot = true

  namespace           = var.namespace
  service_account     = var.service_account
  priority_class_name = var.priority_class_name
  pod_annotations     = var.pod_annotations

  containers = var.containers

  secret_mounts   = var.secret_mounts
  secrets         = var.secrets
  common_env      = var.common_env
  dynamic_secrets = var.dynamic_secrets

  tmp_directories = var.tmp_directories
  mount_owner     = var.mount_owner

  node_preferences  = var.node_preferences
  node_requirements = var.node_requirements
  tolerations       = var.tolerations
  restart_policy    = var.restart_policy

  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

resource "kubernetes_manifest" "deployment" {
  manifest = {
    apiVersion = "apps/v1"
    kind       = "Deployment"
    metadata = {
      namespace = var.namespace
      name      = var.service_name
      labels    = module.kube_labels.kube_labels
      annotations = {
        "reloader.stakater.com/auto" = "true"
      }
    }
    spec = {
      replicas = var.min_replicas
      strategy = {
        type = var.deployment_update_type
      }
      selector = {
        matchLabels = module.pod_template.match_labels
      }
      template = module.pod_template.pod_template
    }
  }
  computed_fields = flatten(concat(

    // The defaults used by the provider
    [
      "metadata.labels",
      "metadata.annotations"
    ],

    // The prevents an error when the kubernetes API server changes the units used
    // in these fields during the apply
    [for i, k in keys(module.pod_template.containers) : [
      "spec.template.spec.containers[${i}].resources.requests",
      "spec.template.spec.containers[${i}].resources.limits",
    ]],
    [for i, k in keys(module.pod_template.init_containers) : [
      "spec.template.spec.initContainers[${i}].resources.requests",
      "spec.template.spec.initContainers[${i}].resources.limits",
    ]],

    // Runs into an issue when using empty lists
    [for i, k in keys(module.pod_template.containers) : [
      "spec.template.spec.containers[${i}].securityContext.capabilities",
    ]],
    [for i, k in keys(module.pod_template.init_containers) : [
      "spec.template.spec.initContainers[${i}].securityContext.capabilities",
    ]],
    [
      "spec.template.spec.affinity.nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution",
      "spec.template.spec.affinity.podAntiAffinity.requiredDuringSchedulingIgnoredDuringExecution"
    ]
  ))

  field_manager {
    force_conflicts = true
  }
}

resource "kubernetes_manifest" "vpa_server" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = var.service_name
      namespace = var.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = var.service_name
      }
      updatePolicy = {
        updateMode = "Auto"
      }
      resourcePolicy = {
        containerPolicies = [for config in var.containers : {
          containerName = config.name
          minAllowed = {
            memory = "${config.minimum_memory}Mi"
            cpu    = "${config.minimum_cpu}m"
          }
        }]
      }
    }
  }
  depends_on = [kubernetes_manifest.deployment]
}


# Todo: Need to enable a custom metrics query via prometheus
# for multi-dimensional autoscaling
#resource "kubernetes_horizontal_pod_autoscaler_v2" "autoscaler" {
#  metadata {
#    name = var.service_name
#    namespace = var.namespace
#    labels = module.kube_labels.kube_labels
#  }
#  spec {
#    scale_target_ref {
#      api_version = "apps/v1"
#      kind = "Deployment"
#      name = kubernetes_deployment.deployment.metadata[0].name
#    }
#    min_replicas = local.min_replicas
#    max_replicas = var.max_replicas
#    metric {
#      type = "Resource"
#      resource {
#        name = "memory"
#        target {
#          type = "Utilization"
#          average_utilization = 75
#        }
#      }
#    }
#    metric {
#      type = "Resource"
#      resource {
#        name = "cpu"
#        target {
#          type = "Utilization"
#          average_utilization = 75
#        }
#      }
#    }
#    behavior {
#      scale_down {
#        select_policy                = "Max"
#        stabilization_window_seconds = 300
#
#        policy {
#          period_seconds = 60
#          type           = "Pods"
#          value          = 1
#        }
#      }
#
#      scale_up {
#        select_policy                = "Max"
#        stabilization_window_seconds = 300
#
#        policy {
#          period_seconds = 60
#          type           = "Pods"
#          value          = 1
#        }
#      }
#    }
#  }
#}

resource "kubernetes_service" "service" {
  metadata {
    name      = var.service_name
    namespace = var.namespace
    labels = merge(
      module.kube_labels.kube_labels,
      {}
    )
  }
  spec {
    type = "ClusterIP"
    dynamic "port" {
      for_each = var.ports
      content {
        port        = port.value.service_port
        target_port = port.value.pod_port
        protocol    = "TCP"
        name        = port.key
      }
    }
    selector = module.pod_template.match_labels
  }
}

resource "kubernetes_manifest" "pdb" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${var.service_name}-pdb"
      namespace = var.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = module.pod_template.match_labels
      }
      maxUnavailable             = 1
      unhealthyPodEvictionPolicy = "AlwaysAllow"
    }
  }
}

