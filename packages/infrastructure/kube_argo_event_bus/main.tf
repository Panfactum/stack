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

data "pf_kube_labels" "labels" {
  module = "kube_argo_event_bus"
}

/***************************************
* Message Broker
***************************************/

module "nats" {
  source = "../kube_nats"

  helm_version = var.helm_version

  namespace = var.namespace

  pull_through_cache_enabled  = var.pull_through_cache_enabled
  node_image_cached_enabled   = var.node_image_cached_enabled
  monitoring_enabled          = var.monitoring_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  vpa_enabled                 = var.vpa_enabled

  arm_nodes_enabled                    = var.arm_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required
  minimum_memory_mb                    = var.minimum_memory_mb

  max_outstanding_catchup_mb = var.max_outstanding_catchup_mb
  fsync_interval_seconds     = var.fsync_interval_seconds
  ping_interval_seconds      = var.ping_interval_seconds
  write_deadline_seconds     = var.write_deadline_seconds
  max_payload_mb             = var.max_payload_mb
  max_control_line_kb        = var.max_control_line_kb
  max_connections            = var.max_connections

  cert_manager_namespace                = var.cert_manager_namespace
  vault_internal_url                    = var.vault_internal_url
  vault_internal_pki_backend_mount_path = var.vault_internal_pki_backend_mount_path

  persistence_storage_class_name                 = var.persistence_storage_class_name
  persistence_backups_enabled                    = var.persistence_backups_enabled
  persistence_initial_storage_gb                 = var.persistence_initial_storage_gb
  persistence_storage_increase_gb                = var.persistence_storage_increase_gb
  persistence_storage_increase_threshold_percent = var.persistence_storage_increase_threshold_percent
  persistence_storage_limit_gb                   = var.persistence_storage_limit_gb

  voluntary_disruptions_enabled             = var.voluntary_disruptions_enabled
  voluntary_disruption_window_enabled       = var.voluntary_disruption_window_enabled
  voluntary_disruption_window_cron_schedule = var.voluntary_disruption_window_cron_schedule
  voluntary_disruption_window_seconds       = var.voluntary_disruption_window_seconds
}

/***************************************
* Event Bus
***************************************/

resource "kubectl_manifest" "event_bus" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "EventBus"
    metadata = {
      name      = "default"
      namespace = var.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      jetstreamExotic = {
        url = "tls://${module.nats.host}:${module.nats.client_port}"
        tls = {
          caCertSecret = {
            name = module.nats.admin_creds_secret
            key  = "ca.crt"
          }
          clientCertSecret = {
            name = module.nats.admin_creds_secret
            key  = "tls.crt"
          }
          clientKeySecret = {
            name = module.nats.admin_creds_secret
            key  = "tls.key"
          }
        }
        streamConfig = yamlencode({
          replicas   = 3
          maxAge     = var.max_age_hours == -1 ? "0h0m0s" : "${var.max_age_hours}h0m0s"
          maxMsgs    = var.max_messages
          maxBytes   = var.max_size_mb == -1 ? -1 : var.max_size_mb * 1024 * 1024
          duplicates = "${var.duplicate_window_seconds}s"
        })
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true

  depends_on = [module.nats]
}
