variable "metrics_server_version" {
  description = "The version of the metrics-server to deploy"
  type        = string
  default     = "v0.6.3"
}

variable "metrics_server_helm_version" {
  description = "The version of the metrics-server helm chart to deploy"
  type        = string
  default     = "3.10.0"
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
