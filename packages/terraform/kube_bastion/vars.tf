variable "bastion_image_version" {
  description = "The version of the image to use for the deployment"
  type        = string
  default     = "alpha"
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
  default     = false
}

variable "ssh_cert_lifetime_seconds" {
  description = "The lifetime of SSH certs provisioned by Vault"
  type        = number
  default     = 60 * 60 * 8
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}