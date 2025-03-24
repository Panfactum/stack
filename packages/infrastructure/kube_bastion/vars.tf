variable "bastion_image_version" {
  description = "The version of the image to use for the deployment"
  type        = string
  default     = "17b5034568b63f0a777bc1f5b7ef907c0e00fa2a"
}

variable "bastion_domains" {
  description = "The domain names of the bastion"
  type        = list(string)
}

variable "bastion_port" {
  description = "The port the bastion should use for the ssh server"
  type        = number
  default     = 45459
  sensitive   = true
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "ssh_cert_lifetime_seconds" {
  description = "The lifetime of SSH certs provisioned by Vault"
  type        = number
  default     = 60 * 60 * 8
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
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

