variable "vertical_autoscaler_helm_version" {
  description = "The version of VPA helm chart to deploy"
  type        = string
  default     = "3.0.2"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
