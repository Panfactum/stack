variable "azwi_version" {
  description = "The version of the azwi mutating webhook to deploy"
  type        = string
  default     = "1.1.0"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
