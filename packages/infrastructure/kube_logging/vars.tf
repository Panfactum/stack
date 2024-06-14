
variable "loki_chart_version" {
  description = "The version of the grafana/loki helm chart to deploy"
  type        = string
  default     = "6.6.2"
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

variable "log_level" {
  description = "The log level for the Loki pods"
  type        = string
  default     = "warn"
  validation {
    condition     = contains(["info", "error", "debug", "warn"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
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

variable "log_retention_period_hours" {
  description = "Number of hours that logs should be retained"
  type        = number
  default     = 24 * 14
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}

variable "enhanced_ha_enabled" {
  description = "Whether to add extra high-availability scheduling constraints at the trade-off of increased cost"
  type        = bool
  default     = true
}


