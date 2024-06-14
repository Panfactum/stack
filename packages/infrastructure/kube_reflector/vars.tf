variable "reflector_helm_version" {
  description = "The image version of the emberstack/reflector helm chart"
  type        = string
  default     = "7.1.262"
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "log_level" {
  description = "The log level for the reflector pods"
  type        = string
  default     = "Error"
  validation {
    condition     = contains(["Verbose", "Debug", "Information", "Warning", "Error", "Fatal"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}