variable "kube_fledged_helm_version" {
  description = "The version of the kube-fledged helm chart"
  type        = string
  default     = "v0.10.0"
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "monitoring_enabled" {
  description = "Whether to allow monitoring CRs to be deployed in the namespace"
  type        = bool
  default     = false
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "log_level" {
  description = "The log level to use for the kube-fledged pods"
  type        = string
  default     = "WARNING"
  validation {
    condition     = contains(["ERROR", "INFO", "WARNING"], var.log_level)
    error_message = "log_level must be one of: ERROR, INFO, WARNING"
  }
}
