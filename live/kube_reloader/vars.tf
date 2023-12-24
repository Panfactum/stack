variable "reloader_version" {
  description = "The image version of the stakater/reloader image"
  type        = string
  default     = "v1.0.1"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
