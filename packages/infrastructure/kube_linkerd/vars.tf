variable "linkerd_helm_version" {
  description = "The version of the linkerd-crd and linkerd-control-plane helm charts to deploy (edge)"
  type        = string
  default     = "2024.11.2"
}

variable "vault_ca_crt" {
  description = "The vault certificate authority public certificate."
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "node_image_cache_enabled" {
  description = "Whether to cache images locally for better startup performance"
  type        = bool
  default     = false
}

variable "log_level" {
  description = "The log level for the Linkerd pods"
  type        = string
  default     = "warn"
  validation {
    condition     = contains(["info", "error", "trace", "warn", "debug"], var.log_level)
    error_message = "Invalid log_level provided."
  }
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

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}

variable "node_image_cached_enabled" {
  description = "Whether to add the container images to the node image cache for faster startup times"
  type        = bool
  default     = true
}

variable "wait" {
  description = "Wait for resources to be in a ready state before proceeding. Disabling this flag will allow upgrades to proceed faster but will disable automatic rollbacks. As a result, manual intervention may be required for deployment failures."
  type        = bool
  default     = true
}
