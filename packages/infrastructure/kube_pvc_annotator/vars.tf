variable "namespace" {
  description = "The namespace the cluster is in"
  type        = string
}

variable "config" {
  description = "The top-level keys are the panfactum.com/pvc-group label values and the values are the corresponding labels and annotations to apply to all PVCs in the group."
  type = map(object({
    labels      = optional(map(string), {})
    annotations = optional(map(string), {})
  }))
}
