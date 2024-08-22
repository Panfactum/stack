variable "namespace" {
  description = "The namespace the PDBs are in"
  type        = string
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the annotator images"
  type        = bool
  default     = true
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "vpa_enabled" {
  description = "Whether to enable the vertical pod autoscaler"
  type        = bool
  default     = true
}

variable "cron_schedule" {
  description = "The times when disruption windows should start"
  type        = string
  default     = "0 4 * * *"
}