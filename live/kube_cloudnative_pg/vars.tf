variable "cloudnative_pg_helm_version" {
  description = "The version of the cloudnative-pg helm chart to deploy"
  type        = string
  default     = "v0.18.2"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
