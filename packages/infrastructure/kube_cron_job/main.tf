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

// This is needed b/c this can never
// change without destroying the CronJob first
resource "random_id" "cron_job_id" {
  byte_length = 8
}

data "pf_kube_labels" "labels" {
  module = "kube_cron_job"
}

module "pod_template" {
  source = "../kube_pod"

  # Pod metadata
  namespace                  = var.namespace
  service_account            = kubernetes_service_account.service_account.metadata[0].name
  workload_name              = var.name
  match_labels               = { id = random_id.cron_job_id.hex }
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
  node_preferences                     = var.node_preferences
  az_spread_preferred                  = false
  az_spread_required                   = false
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  termination_grace_period_seconds     = var.termination_grace_period_seconds
  restart_policy                       = var.restart_policy
  cilium_required                      = var.cilium_required
  linkerd_required                     = var.linkerd_required
  linkerd_enabled                      = var.linkerd_enabled
}

resource "kubernetes_service_account" "service_account" {
  metadata {
    name      = random_id.cron_job_id.hex
    namespace = var.namespace
    labels    = module.pod_template.labels
  }
}

resource "kubectl_manifest" "cron_job" {
  yaml_body = yamlencode({
    apiVersion = "batch/v1"
    kind       = "CronJob"
    metadata = {
      namespace = var.namespace
      name      = var.name
      labels = merge(
        module.pod_template.labels,
        var.extra_labels
      )
      annotations = var.extra_annotations
    }
    spec = {
      concurrencyPolicy          = var.concurrency_policy
      failedJobsHistoryLimit     = var.failed_jobs_history_limit
      successfulJobsHistoryLimit = var.successful_jobs_history_limit
      suspend                    = var.suspend
      startingDeadlineSeconds    = var.starting_deadline_seconds
      schedule                   = var.cron_schedule
      jobTemplate = {
        metadata = {
          labels      = module.pod_template.labels
          annotations = var.job_annotations
        }
        spec = {
          activeDeadlineSeconds   = var.active_deadline_seconds
          backoffLimit            = var.backoff_limit
          template                = module.pod_template.pod_template
          parallelism             = var.pod_parallelism
          completions             = var.pod_completions
          ttlSecondsAfterFinished = var.ttl_seconds_after_finished
          podReplacementPolicy    = var.pod_replacement_policy
        }
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
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
        apiVersion = "batch/v1"
        kind       = "CronJob"
        name       = var.name
      }
      updatePolicy = {
        updateMode = "Initial"
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
  depends_on = [kubectl_manifest.cron_job]
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
      maxUnavailable             = var.disruptions_enabled ? 1 : 0
      unhealthyPodEvictionPolicy = "AlwaysAllow"
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.cron_job]
}