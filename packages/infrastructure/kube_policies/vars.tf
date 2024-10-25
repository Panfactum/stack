variable "default_arm64_toleration_enabled" {
  description = "Whether pods should tolerate arm64 nodes by default"
  type        = bool
  default     = true
}

variable "default_spot_toleration_enabled" {
  description = "Whether pods should tolerate spot nodes by default"
  type        = bool
  default     = true
}

variable "default_burstable_toleration_enabled" {
  description = "Whether pods should tolerate burstable nodes by default"
  type        = bool
  default     = false
}

variable "default_controller_toleration_enabled" {
  description = "Whether pods should tolerate controller (EKS) nodes by default"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether pods should have their images replaced with image references of the ECR pull-through cache."
  type        = bool
  default     = true
}

variable "panfactum_scheduler_enabled" {
  description = "Whether pods should be automatically updated to use the Panfactum bin-packing scheduler."
  type        = bool
  default     = false
}

variable "panfactum_node_image_cache_enabled" {
  description = "Whether support for the node-local image cache should be enabled"
  type        = bool
  default     = true
}

variable "environment_variable_injection_enabled" {
  description = "Whether a standard set of environment variables should be injected into each container"
  type        = bool
  default     = true
}