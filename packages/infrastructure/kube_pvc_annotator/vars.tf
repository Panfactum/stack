variable "namespace" {
  description = "The namespace the cluster is in"
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

variable "config" {
  description = "Configuration to pass to pf-set-pvc-metadata. The top-level keys are the panfactum.com/pvc-group label values and the values are the corresponding labels and annotations to apply to all PVCs in the group."
  type = map(object({
    labels      = optional(map(string), {})
    annotations = optional(map(string), {})
  }))
}
