variable "trust_manager_version" {
  description = "The version of trust-manager to deploy"
  type        = string
  default     = "0.9.1"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "namespace" {
  description = "The name of the cert-manager namespace."
  type        = string
  default     = "cert-manager"
}