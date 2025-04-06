variable "keda_helm_version" {
  description = "The version of the KEDA helm chart to deploy"
  type        = string
  default     = "2.16.1"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
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

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "log_level" {
  description = "The log level for the KEDA pods"
  type        = string
  default     = "error"
  validation {
    condition     = contains(["debug", "info", "error"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "scaled_object_max_concurrent_reconciles" {
  description = "The maximum number of concurrent reconciliations for ScaledObjects. Raising this will improve throughput but also resource usage."
  type        = number
  default     = 5
}

variable "scaled_job_max_concurrent_reconciles" {
  description = "The maximum number of concurrent reconciliations for ScaledJobs. Raising this will improve throughput but also resource usage."
  type        = number
  default     = 5
}