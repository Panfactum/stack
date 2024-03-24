
variable "secrets_store_csi_helm_version" {
  description = "The version of the secrets-store-csi-driver helm chart to deploy"
  type        = string
  default     = "1.4.2"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}