variable "additional_labels" {
  type        = map(string)
  description = "Additional labels to be added to the kube labels map"
  default     = {}
}
