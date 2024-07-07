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
  }
}

locals {
  pvc_annotations = { for name, config in var.volume_mounts : "${var.namespace}.${var.name}.${name}" => {
    "velero.io/exclude-from-backups"  = tostring(!config.backups_enabled)
    "resize.topolvm.io/storage_limit" = "${config.size_limit_gb != null ? config.size_limit_gb : 10 * config.initial_size_gb}Gi"
    "resize.topolvm.io/increase"      = "${config.increase_gb}Gi"
    "resize.topolvm.io/threshold"     = "${config.increase_threshold_percent}%"
  } }
}

// This is needed b/c this can never
// change without destroying the StatefulSet first
resource "random_id" "sts_id" {
  byte_length = 8
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "constants" {
  source = "../kube_constants"
}

module "pod_template" {
  source = "../kube_pod"

  # Pod metadata
  namespace                  = var.namespace
  service_account            = kubernetes_service_account.service_account.metadata[0].name
  workload_name              = var.name
  match_labels               = { id = random_id.sts_id.hex }
  dns_policy                 = var.dns_policy
  pod_annotations            = var.pod_annotations
  extra_pod_labels           = var.extra_pod_labels
  pod_version_labels_enabled = var.pod_version_labels_enabled

  # Container configuration
  common_env = var.common_env
  containers = var.containers

  # Mount configuration
  config_map_mounts   = var.config_map_mounts
  secret_mounts       = var.secret_mounts
  secrets             = var.secrets
  dynamic_secrets     = var.dynamic_secrets
  tmp_directories     = var.tmp_directories
  mount_owner         = var.mount_owner
  extra_volume_mounts = { for name, config in var.volume_mounts : name => { mount_path : config.mount_path } }

  # Scheduling params
  priority_class_name                   = var.priority_class_name
  burstable_nodes_enabled               = var.burstable_nodes_enabled
  spot_nodes_enabled                    = var.spot_nodes_enabled
  arm_nodes_enabled                     = var.arm_nodes_enabled
  instance_type_anti_affinity_preferred = var.instance_type_anti_affinity_preferred
  instance_type_anti_affinity_required  = var.instance_type_anti_affinity_required
  zone_anti_affinity_required           = var.zone_anti_affinity_required
  host_anti_affinity_required           = var.host_anti_affinity_required
  extra_tolerations                     = var.extra_tolerations
  controller_node_required              = var.controller_node_required
  node_requirements                     = var.node_requirements
  node_preferences                      = var.node_preferences
  prefer_spot_nodes_enabled             = var.prefer_spot_nodes_enabled
  prefer_burstable_nodes_enabled        = var.prefer_burstable_nodes_enabled
  prefer_arm_nodes_enabled              = var.prefer_arm_nodes_enabled
  topology_spread_enabled               = var.topology_spread_enabled
  topology_spread_strict                = var.topology_spread_strict
  panfactum_scheduler_enabled           = var.panfactum_scheduler_enabled
  termination_grace_period_seconds      = var.termination_grace_period_seconds
  restart_policy                        = var.restart_policy

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

resource "kubernetes_service_account" "service_account" {
  metadata {
    name      = random_id.sts_id.hex
    namespace = var.namespace
    labels    = module.pod_template.labels
  }
}

resource "kubernetes_service" "headless" {
  metadata {
    name      = "${var.name}-headless"
    namespace = var.namespace
    labels    = module.pod_template.labels
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
      serviceName         = kubernetes_service.headless.metadata[0].name
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
              pvc-group = "${var.namespace}.${var.name}.${name}"
            }
            annotations = {
              "resize.topolvm.io/initial-resize-group-by" = "pvc-group"
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
}

resource "kubernetes_config_map" "pvc_annotations" {
  metadata {
    name      = "${var.name}-pvc-config"
    namespace = var.namespace
    labels    = module.pod_template.labels
  }
  data = { for name, config in var.volume_mounts : "${var.namespace}.${var.name}.${name}" => yamlencode({
    "velero.io/exclude-from-backups"  = tostring(!config.backups_enabled)
    "resize.topolvm.io/storage_limit" = "${config.size_limit_gb != null ? config.size_limit_gb : 10 * config.initial_size_gb}Gi"
    "resize.topolvm.io/increase"      = "${config.increase_gb}Gi"
    "resize.topolvm.io/threshold"     = "${config.increase_threshold_percent}%"
  }) }
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
      unhealthyPodEvictionPolicy = "AlwaysAllow"
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.stateful_set]
}

/***************************************
* PVC Annotation Provider
*
* This is required due to issues like this:
* https://github.com/topolvm/pvc-autoresizer/issues/262
***************************************/

resource "kubernetes_role" "pvc_annotator" {
  metadata {
    name      = "pvc-annotate-${random_id.sts_id.hex}"
    namespace = var.namespace
    labels    = module.pvc_annotator.labels
  }
  rule {
    api_groups = [""]
    resources  = ["persistentvolumeclaims"]
    verbs      = ["get", "update", "list"]
  }
}

resource "kubernetes_role_binding" "pvc_annotator" {
  metadata {
    name      = "pvc-annotate-${random_id.sts_id.hex}"
    namespace = var.namespace
    labels    = module.pvc_annotator.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.pvc_annotator.service_account_name
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.pvc_annotator.metadata[0].name
  }
}

module "pvc_annotator" {
  source = "../kube_cron_job"

  name                        = "pvc-annotate-${random_id.sts_id.hex}"
  namespace                   = var.namespace
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  spot_nodes_enabled          = true
  arm_nodes_enabled           = true
  burstable_nodes_enabled     = true
  vpa_enabled                 = var.vpa_enabled

  cron_schedule = "*/15 * * * *"
  containers = [{
    name    = "pvc-annotate"
    image   = "${module.pull_through.ecr_public_registry}/${module.constants.panfactum_image}"
    version = module.constants.panfactum_image_version
    command = [
      "/bin/pf-set-pvc-annotations",
      "--config=${jsonencode(local.pvc_annotations)}",
      "--namespace=${var.namespace}"
    ]
    minimum_memory = 50
  }]
  starting_deadline_seconds = 60 * 5
  active_deadline_seconds   = 60 * 5

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

