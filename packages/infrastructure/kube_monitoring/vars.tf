variable "kube_prometheus_stack_version" {
  description = "The version of the kube-prometheus-stack to deploy"
  type        = string
  default     = "58.5.3"
}

variable "thanos_chart_version" {
  description = "The version of the bitnami/thanos helm chart to deploy"
  type        = string
  default     = "15.4.7"
}

variable "loki_chart_version" {
  description = "The version of the grafana/loki helm chart to deploy"
  type        = string
  default     = "6.6.2"
}

variable "thanos_image_version" {
  description = "The version of thanos images to use"
  type        = string
  default     = "v0.35.0"
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "grafana_domain" {
  description = "The domain on which to expose Grafana."
  type        = string
}

variable "grafana_basic_auth_enabled" {
  description = "Whether to enable username and password authentication. Should only be enabled during debugging."
  type        = bool
  default     = true // TODO: Change to false
}

variable "grafana_log_level" {
  description = "The log level for the grafana pods"
  type        = string
  default     = "error"
  validation {
    condition     = contains(["info", "error", "warn", "debug", "critical"], var.grafana_log_level)
    error_message = "Invalid grafana_log_level provided."
  }
}

variable "vault_domain" {
  description = "The domain of the Vault instance running in the cluster."
  type        = string
}


variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "ingress_enabled" {
  description = "Whether or not to enable the ingress for routing public traffic to prometheus stack components"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "prometheus_operator_log_level" {
  description = "The log level for the prometheus operator pods"
  type        = string
  default     = "warn"
  validation {
    condition     = contains(["info", "error", "warn", "debug"], var.prometheus_operator_log_level)
    error_message = "Invalid prometheus_operator_log_level provided."
  }
}

variable "prometheus_log_level" {
  description = "The log level for the prometheus pods"
  type        = string
  default     = "warn"
  validation {
    condition     = contains(["info", "error", "warn", "debug"], var.prometheus_log_level)
    error_message = "Invalid prometheus_log_level provided."
  }
}

variable "alertmanager_log_level" {
  description = "The log level for the alertmanager pods"
  type        = string
  default     = "warn"
  validation {
    condition     = contains(["info", "error", "warn", "debug"], var.alertmanager_log_level)
    error_message = "Invalid alertmanager_log_level provided."
  }
}

variable "thanos_log_level" {
  description = "The log level for the thanos pods"
  type        = string
  default     = "warn"
  validation {
    condition     = contains(["info", "error", "warn", "debug"], var.thanos_log_level)
    error_message = "Invalid thanos_log_level provided."
  }
}

variable "prometheus_default_scrape_interval_seconds" {
  description = "The default interval between prometheus scrapes (in seconds)"
  type        = number
  default     = 60
}

variable "prometheus_storage_class_name" {
  description = "The storage class to use for local prometheus storage"
  type        = string
  default     = "ebs-standard"
}

variable "prometheus_local_storage_initial_size_gb" {
  description = "Number of GB to use for the local prometheus storage (before autoscaled)"
  type        = number
  default     = 2
}

variable "metrics_retention_resolution_raw" {
  description = "Number of days the raw metrics resolution should be kept"
  type        = number
  default     = 15
}

variable "metrics_retention_resolution_5m" {
  description = "Number of days 5m metrics resolution should be kept"
  type        = number
  default     = 90
}

variable "metrics_retention_resolution_1h" {
  description = "Number of days 1h metrics resolution should be kept"
  type        = number
  default     = 365 * 5
}

variable "thanos_compactor_disk_storage_gb" {
  description = "Number of GB for the ephemeral thanos compactor disk. See https://thanos.io/tip/components/compact.md/#disk"
  type        = number
  default     = 100
}

variable "thanos_compactor_storage_class_name" {
  description = "The storage class to use for the thanos compactor local storage"
  type        = string
  default     = "ebs-standard"
}

variable "thanos_store_gateway_storage_class_name" {
  description = "The storage class to use for the thanos store gateway local storage"
  type        = string
  default     = "ebs-standard"
}

variable "thanos_ruler_storage_class_name" {
  description = "The storage class to use for the thanos ruler local storage"
  type        = string
  default     = "ebs-standard"
}

variable "thanos_bucket_web_enable" {
  description = "Whether to enable the web dashboard for the Thanos bucket analyzer which can show debugging information about your metrics data"
  type        = bool
  default     = true
}

variable "thanos_bucket_web_domain" {
  description = "Domain to host the Thanos bucket web UI on. If not provided, will be on the same subdomain as grafana but with the thanos-bucket identifier (thanos-bucket.\\<grafana-subdomain\\>)"
  type        = string
  default     = null
}

variable "alertmanager_storage_class_name" {
  description = "The storage class to use for local alertmanager storage"
  type        = string
  default     = "ebs-standard"
}

variable "alertmanager_local_storage_initial_size_gb" {
  description = "Number of GB to use for the local alertmanager storage (before autoscaled)"
  type        = number
  default     = 2
}

variable "monitoring_etcd_enabled" {
  description = "Whether to monitor the Kubernetes API server's etcd instances. Only enable for debugging purposes as it contains a huge amount of metrics."
  type        = bool
  default     = false
}

variable "additional_tracked_resource_labels" {
  description = "Kubernetes resource labels to include in metric labels"
  type        = list(string)
  default     = []
}

variable "additional_tracked_resources" {
  description = "Additional Kubernetes resources to track in kube-state-metrics"
  type        = list(string)
  default     = []
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}

variable "loki_storage_class_name" {
  description = "The storage class to use for local loki storage"
  type        = string
  default     = "ebs-standard"
}

variable "enhanced_ha_enabled" {
  description = "Whether to add extra high-availability scheduling constraints at the trade-off of increased cost"
  type        = bool
  default     = true
}

variable "kube_api_server_monitoring_enabled" {
  description = "Whether to enable monitoring of the API server"
  type        = bool
  default     = false
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}

variable "grafana_db_recovery_mode_enabled" {
  description = "Whether to enable recovery mode for the Grafana PostgreSQL database"
  type        = bool
  default     = false
}

variable "grafana_db_recovery_directory" {
  description = "The name of the directory in the backup bucket that contains the Grafana PostgreSQL backups and WAL archives"
  type        = string
  default     = null
}

variable "grafana_db_recovery_target_time" {
  description = "If provided, will recover the Grafana PostgreSQL database to the indicated target time in RFC 3339 format rather than to the latest data."
  type        = string
  default     = null
}


