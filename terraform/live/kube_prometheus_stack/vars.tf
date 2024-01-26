variable "kube_prometheus_stack_version" {
  description = "The version of cert-manager to deploy"
  type        = string
  default     = "48.3.1"
}

variable "environment_domain" {
  description = "The domain on which to bind service records."
  type        = string
}

variable "admin_groups" {
  description = "AAD groups that should have admin access to grafana"
  type        = list(string)
  default     = []
}

variable "editor_groups" {
  description = "AAD groups that should have write access to grafana"
  type        = list(string)
  default     = []
}

variable "reader_groups" {
  description = "AAD groups that should have read-only access to grafana"
  type        = list(string)
  default     = []
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
