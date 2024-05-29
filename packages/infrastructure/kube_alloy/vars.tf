
variable "alloy_chart_version" {
  description = "The version of the grafana/alloy helm chart to deploy"
  type        = string
  default     = "0.3.1"
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "log_level" {
  description = "The log level for the Alloy pods"
  type        = string
  default     = "warn"
  validation {
    condition     = contains(["info", "error", "debug", "warn"], var.log_level)
    error_message = "Invalid log_level provided."
  }
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


