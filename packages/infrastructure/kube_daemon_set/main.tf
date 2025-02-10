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
  all_ports = merge([for container_name, config in var.containers : config.ports]...)
  service_ports = { for name, config in local.all_ports : name => {
    pod_port     = config.port
    service_port = config.service_port
    protocol     = config.protocol
  } if config.expose_on_service }
}

// This is needed b/c this can never
// change without destroying the deployment first
resource "random_id" "daemon_set_id" {
  byte_length = 8
}

data "pf_kube_labels" "labels" {
  module = "kube_daemon_set"
}

module "pod_template" {
  source = "../kube_pod"

  # Pod metadata
  namespace                  = var.namespace
  service_account            = kubernetes_service_account.service_account.metadata[0].name
  workload_name              = var.name
  match_labels               = { id = random_id.daemon_set_id.hex }
  dns_policy                 = var.dns_policy
  host_network               = var.host_network
  extra_pod_annotations      = var.extra_pod_annotations
  extra_pod_labels           = var.extra_pod_labels
  pod_version_labels_enabled = var.pod_version_labels_enabled
  extra_labels               = data.pf_kube_labels.labels.labels

  # Container configuration
  common_env                  = var.common_env
  common_secrets              = var.common_secrets
  common_env_from_secrets     = var.common_env_from_secrets
  common_env_from_config_maps = var.common_env_from_config_maps
  containers                  = var.containers
  pull_through_cache_enabled  = var.pull_through_cache_enabled

  # Mount configuration
  config_map_mounts = var.config_map_mounts
  secret_mounts     = var.secret_mounts
  tmp_directories   = var.tmp_directories
  mount_owner       = var.mount_owner

  # Scheduling params
  priority_class_name                  = var.priority_class_name
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  instance_type_anti_affinity_required = false
  az_anti_affinity_required            = false
  host_anti_affinity_required          = false
  extra_tolerations                    = var.extra_tolerations
  controller_nodes_required            = false
  node_requirements                    = var.node_requirements
  node_preferences                     = {}
  az_spread_preferred                  = false
  az_spread_required                   = false
  panfactum_scheduler_enabled          = false
  termination_grace_period_seconds     = var.termination_grace_period_seconds
  restart_policy                       = var.restart_policy
  cilium_required                      = var.cilium_required
  linkerd_required                     = var.linkerd_required
  linkerd_enabled                      = var.linkerd_enabled
}

resource "kubernetes_service_account" "service_account" {
  metadata {
    name      = random_id.daemon_set_id.hex
    namespace = var.namespace
    labels    = module.pod_template.labels
  }
}

resource "kubectl_manifest" "daemon_set" {
  yaml_body = yamlencode({
    apiVersion = "apps/v1"
    kind       = "DaemonSet"
    metadata = {
      namespace = var.namespace
      name      = var.name
      labels = merge(
        module.pod_template.labels,
        var.extra_labels
      )
      annotations = merge(
        {
          "reloader.stakater.com/auto" = "true"
        },
        var.extra_annotations
      )
    }
    spec = {
      minReadySeconds = var.min_ready_seconds
      updateStrategy = {
        type = var.update_type
      }
      selector = {
        matchLabels = module.pod_template.match_labels
      }
      template = module.pod_template.pod_template
    }
  })
  server_side_apply = true
  force_conflicts   = true
  wait_for_rollout  = var.wait_for_rollout
}

resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = var.name
      namespace = var.namespace
      labels    = module.pod_template.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = var.name
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      resourcePolicy = {
        containerPolicies = [for config in var.containers : {
          containerName = config.name
          minAllowed = {
            memory = "${config.minimum_memory}Mi"
            cpu    = "${config.minimum_cpu}m"
          }
          maxAllowed = { for k, v in {
            memory = config.maximum_memory != null ? "${config.maximum_memory}Mi" : null
            cpu    = config.maximum_cpu != null ? "${config.maximum_cpu}Mi" : null
          } : k => v if v != null }
        }]
      }
    }
  })
  depends_on = [kubectl_manifest.daemon_set]
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${var.name}-pdb"
      namespace = var.namespace
      labels    = module.pod_template.labels
    }
    spec = {
      selector = {
        matchLabels = module.pod_template.match_labels
      }
      minAvailable               = var.min_available # Needs to be minAvailable as daemonset does not implement the scale subresource
      unhealthyPodEvictionPolicy = var.unhealthy_pod_eviction_policy
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.daemon_set]
}
