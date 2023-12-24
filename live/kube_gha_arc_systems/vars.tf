variable "gha_runner_scale_set_controller_version" {
  description = "The version of the arc scale set controller to deploy"
  type        = string
  default     = "0.6.1"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
