variable "descheduler_helm_version" {
  description = "The version of the descheduler helm chart to deploy"
  type        = string
  default     = "0.31.0"
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
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

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "max_pod_lifetime_seconds" {
  description = "The maximum time that a pod can live before being replaced (unless lifetime evictions are disabled for the pod)"
  type        = number
  default     = 60 * 60 * 4
}

variable "wait" {
  description = "Wait for resources to be in a ready state before proceeding. Disabling this flag will allow upgrades to proceed faster but will disable automatic rollbacks. As a result, manual intervention may be required for deployment failures."
  type        = bool
  default     = true
}

variable "spot_nodes_enabled" {
  description = "Whether to allow pods to schedule on spot nodes"
  type        = bool
  default     = true
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow pods to schedule on burstable nodes"
  type        = bool
  default     = true
}

variable "controller_nodes_enabled" {
  description = "Whether to allow pods to schedule on EKS Node Group nodes (controller nodes)"
  type        = bool
  default     = true
}
