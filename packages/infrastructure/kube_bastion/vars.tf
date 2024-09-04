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

variable "enhanced_ha_enabled" {
  description = "Whether to add extra high-availability scheduling constraints at the trade-off of increased cost"
  type        = bool
  default     = true
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}
