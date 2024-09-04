variable "argo_workflows_helm_version" {
  description = "The version of the argo workflows helm chart to deploy"
  type        = string
  default     = "0.41.1"
}

variable "argo_events_helm_version" {
  description = "The version of the argo events helm chart to deploy"
  type        = string
  default     = "2.4.4"
}

variable "argo_domain" {
  description = "The domain to use for the argo UI. Must be in a subdomain available to the environment."
  type        = string
}

variable "vault_domain" {
  description = "The domain of the Vault instance running in the cluster."
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "ingress_enabled" {
  description = "Whether or not to enable the ingress for routing traffic to argo"
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "node_image_cache_enabled" {
  description = "Whether to use kube-fledged to cache images locally for better startup performance"
  type        = bool
  default     = true
}

variable "log_level" {
  description = "The log level for the argo pods"
  type        = string
  default     = "info"
  validation {
    condition     = contains(["info", "error", "warn", "debug"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster that contains the service account."
  type        = string
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "workflow_archive_ttl" {
  description = "Length of time that previously run workflow states are stored"
  type        = string
  default     = "60d"
}

variable "event_bus_nats_version" {
  description = "The version of nats to use for the event bus"
  type        = string
  default     = "2.10.14"
}

variable "event_bus_prometheus_nats_exporter_version" {
  description = "The version of prometheus-nats-exporter to use for the event bus"
  type        = string
  default     = "0.15.0"
}

variable "event_bus_nats_server_config_reloader_version" {
  description = "The version of nats-server-config-reloader to use for the event bus"
  type        = string
  default     = "0.14.2"
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}

variable "enhanced_ha_enabled" {
  description = "Whether to add extra high-availability scheduling constraints at the trade-off of increased cost"
  type        = bool
  default     = true
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}

variable "test_workflow_enabled" {
  description = "Whether to enable the test WorkflowTemplate"
  type        = bool
  default     = false
}

variable "db_recovery_mode_enabled" {
  description = "Whether to enable recovery mode for the PostgreSQL database"
  type        = bool
  default     = false
}

variable "db_recovery_directory" {
  description = "The name of the directory in the backup bucket that contains the PostgreSQL backups and WAL archives"
  type        = string
  default     = null
}

variable "db_recovery_target_time" {
  description = "If provided, will recover the PostgreSQL database to the indicated target time in RFC 3339 format rather than to the latest data."
  type        = string
  default     = null
}
