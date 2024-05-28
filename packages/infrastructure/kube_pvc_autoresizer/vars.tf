
// From https://artifacthub.io/packages/helm/pvc-autoresizer/pvc-autoresizer
variable "pvc_autoresizer_helm_version" {
  description = "The version of the pvc-autoresizer helm chart to deploy"
  type        = string
  default     = "0.11.2"
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

variable "log_verbosity" {
  description = "The log verbosity (0-9) for the VPA pods"
  type        = number
  default     = 0
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}