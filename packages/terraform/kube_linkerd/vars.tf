variable "linkerd_helm_version" {
  description = "The version of the linkerd-crd and linkerd-control-plane helm charts to deploy (edge)"
  type        = string
  default     = "2024.3.3"
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
  default     = false
}
