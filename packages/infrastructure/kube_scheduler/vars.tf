variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
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

variable "sla_target" {
  description = "The Panfactum SLA level for the module deployment. 1 = lowest uptime (99.9%), lowest cost -- 3 = highest uptime (99.999%), highest Cost"
  type        = number
  default     = 3

  validation {
    condition     = var.sla_target <= 3 && var.sla_target >= 1
    error_message = "sla_target must be one of: 1, 2, 3"
  }
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
    condition     = var.log_verbosity <= 10
    error_message = "Log verbosity must be less than or equal to 10"
  }
}
