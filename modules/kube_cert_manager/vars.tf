variable "cert_manager_version" {
  description = "The version of cert-manager to deploy"
  type        = string
  default     = "1.12.0"
}

variable "trust_manager_version" {
  description = "The version of trust-manager to deploy"
  type        = string
  default     = "0.5.0"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
