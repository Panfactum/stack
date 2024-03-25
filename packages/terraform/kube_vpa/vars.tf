variable "vertical_autoscaler_helm_version" {
  description = "The version of VPA helm chart to deploy"
  type        = string
  default     = "4.4.5"
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

