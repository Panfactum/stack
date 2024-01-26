variable "bastion_image" {
  description = "The bastion image repo to use"
  type        = string
  default     = "487780594448.dkr.ecr.us-east-2.amazonaws.com/bastion"
}

variable "bastion_image_version" {
  description = "The version of the image to use for the deployment"
  type        = string
}

variable "bastion_ca_keys" {
  description = "The bastion CA public key from Vault"
  type        = string
}

variable "bastion_domain" {
  description = "The domain name of the bastion"
  type        = string
}

variable "bastion_port" {
  description = "The port the bastion should use for the ssh server"
  type        = number
  default     = 45459
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}