
variable "secrets_store_csi_helm_version" {
  description = "The version of the secrets-store-csi-driver helm chart to deploy"
  type        = string
  default     = "1.3.4"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
