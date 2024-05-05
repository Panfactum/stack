variable "cloudnative_pg_helm_version" {
  description = "The version of the cloudnative-pg helm chart to deploy"
  type        = string
  default     = "v0.21.2"
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

variable "log_level" {
  description = "The log level for the operator pods"
  type        = string
  default     = "error"
  validation {
    condition     = contains(["info", "error", "trace", "debug"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

