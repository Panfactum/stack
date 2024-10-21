terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
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
// change without destroying the StatefulSet first
resource "random_id" "sts_id" {
  byte_length = 8
}

data "pf_kube_labels" "labels" {
  module = "kube_stateful_set"
}

module "pod_template" {
  source = "../kube_pod"

  # Pod metadata
  namespace                  = var.namespace
  service_account            = kubernetes_service_account.service_account.metadata[0].name
  workload_name              = var.name
  match_labels               = { id = random_id.sts_id.hex }
  dns_policy                 = var.dns_policy
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

  # Mount configuration
  config_map_mounts   = var.config_map_mounts
  secret_mounts       = var.secret_mounts
  tmp_directories     = var.tmp_directories
  mount_owner         = var.mount_owner
  extra_volume_mounts = { for name, config in var.volume_mounts : name => { mount_path : config.mount_path } }

  # Scheduling params
  priority_class_name                  = var.priority_class_name
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required
  az_anti_affinity_required            = var.az_anti_affinity_required
  host_anti_affinity_required          = var.host_anti_affinity_required
  extra_tolerations                    = var.extra_tolerations
  controller_nodes_required            = var.controller_nodes_required
  node_requirements                    = var.node_requirements
  node_preferences                     = var.node_preferences
  az_spread_preferred                  = var.az_spread_preferred
  az_spread_required                   = var.az_spread_required
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  termination_grace_period_seconds     = var.termination_grace_period_seconds
  restart_policy                       = var.restart_policy
}

resource "kubernetes_service_account" "service_account" {
  metadata {
    name      = random_id.sts_id.hex
    namespace = var.namespace
    labels    = module.pod_template.labels
  }
}

module "service_headless" {
  source = "../kube_service"

  type             = "ClusterIP"
  name             = "${var.name}-headless"
  namespace        = var.namespace
  ports            = local.service_ports
  match_labels     = module.pod_template.match_labels
  extra_labels     = module.pod_template.labels
  headless_enabled = true
}

resource "kubectl_manifest" "stateful_set" {
  yaml_body = yamlencode({
    apiVersion = "apps/v1"
    kind       = "StatefulSet"
    metadata = {
      namespace = var.namespace
      name      = var.name
      labels    = module.pod_template.labels
      annotations = {
        "reloader.stakater.com/auto" = "true"
      }
    }
    spec = {
      serviceName         = "${var.name}-headless"
      podManagementPolicy = var.pod_management_policy
      replicas            = var.replicas
      updateStrategy = {
        type = var.update_type
      }
      selector = {
        matchLabels = module.pod_template.match_labels
      }
      template = module.pod_template.pod_template
      volumeClaimTemplates = [
        for name, config in var.volume_mounts : {
          metadata = {
            name = name
            labels = {
              "panfactum.com/pvc-group" = "${var.namespace}.${var.name}.${name}"
            }
            annotations = {
              "resize.topolvm.io/initial-resize-group-by" = "panfactum.com/pvc-group"
            }
          }
          spec = {
            storageClassName = config.storage_class
            accessModes      = config.access_modes
            resources = {
              requests = {
                storage = "${config.initial_size_gb}Gi"
              }
            }
          }
        }
      ]
      persistentVolumeClaimRetentionPolicy = {
        whenDeleted = var.volume_retention_policy.when_deleted
        whenScaled  = var.volume_retention_policy.when_scaled
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  ignore_fields = var.ignore_replica_count ? [
    "spec.replicas"
  ] : []
  depends_on = [module.service_headless]
}

module "service" {
  count  = length(keys(local.service_ports)) > 0 ? 1 : 0
  source = "../kube_service"

  type                = var.service_type
  load_balancer_class = var.service_load_balancer_class
  public_domain_names = var.service_public_domain_names
  name                = var.service_name == null ? var.name : var.service_name
  namespace           = var.namespace
  ports               = local.service_ports
  service_ip          = var.service_ip
  match_labels        = module.pod_template.match_labels
  extra_labels        = module.pod_template.labels

  depends_on = [kubectl_manifest.stateful_set]
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
        kind       = "StatefulSet"
        name       = var.name
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
          maxAllowed = { for k, v in {
            memory = config.maximum_memory != null ? "${config.maximum_memory}Mi" : null
            cpu    = config.maximum_cpu != null ? "${config.maximum_cpu}Mi" : null
          } : k => v if v != null }
        }]
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.stateful_set]
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
      maxUnavailable             = var.max_unavailable
      unhealthyPodEvictionPolicy = var.unhealthy_pod_eviction_policy
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.stateful_set]
}

module "pvc_annotator" {
  source = "../kube_pvc_annotator"

  namespace                   = var.namespace
  vpa_enabled                 = var.vpa_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  config = { for name, config in var.volume_mounts : "${var.namespace}.${var.name}.${name}" => {
    annotations = {
      "velero.io/exclude-from-backups"  = tostring(!config.backups_enabled)
      "resize.topolvm.io/storage_limit" = "${config.size_limit_gb != null ? config.size_limit_gb : 10 * config.initial_size_gb}Gi"
      "resize.topolvm.io/increase"      = "${config.increase_gb}Gi"
      "resize.topolvm.io/threshold"     = "${config.increase_threshold_percent}%"
    }
    labels = module.pod_template.labels
  } }
}
