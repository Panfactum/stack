variable "descheduler_version" {
  description = "The version of the descheduler to deploy"
  type        = string
  default     = "v0.27.1"
}

variable "descheduler_helm_version" {
  description = "The version of the descheduler helm chart to deploy"
  type        = string
  default     = "0.27.1"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
