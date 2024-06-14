variable "scheduler_version" {
  description = "The version of the kube-scheduler to deploy"
  type        = string
  default     = "v1.29.6"
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

variable "enhanced_ha_enabled" {
  description = "Whether to add extra high-availability scheduling constraints at the trade-off of increased cost"
  type        = bool
  default     = true
}

variable "log_verbosity" {
  description = "The log verbosity (1-9) for the scheduler pods"
  type        = number
  default     = 0

  validation {
    condition     = var.log_verbosity >= 0
    error_message = "Log verbosity must be greater than or equal to 0"
  }

  validation {
    condition     = var.log_verbosity <= 9
    error_message = "Log verbosity must be less than or equal to 9"
  }
}
