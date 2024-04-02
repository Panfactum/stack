variable "descheduler_helm_version" {
  description = "The version of the descheduler helm chart to deploy"
  type        = string
  default     = "0.29.0"
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

variable "log_verbosity" {
  description = "The log verbosity (1-9) for the descheduler pods"
  type        = number
  default     = 1

  validation {
    condition     = var.log_verbosity >= 1
    error_message = "Log verbosity must be greater than or equal to 1"
  }

  validation {
    condition     = var.log_verbosity <= 9
    error_message = "Log verbosity must be less than or equal to 9"
  }
}