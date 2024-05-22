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

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "monitoring_enabled" {
  description = "Whether to allow monitoring CRs to be deployed in the namespace"
  type        = bool
  default     = false
}