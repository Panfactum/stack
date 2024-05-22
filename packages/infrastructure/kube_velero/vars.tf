variable "velero_helm_version" {
  description = "The version of the velero helm chart"
  type        = string
  default     = "6.0.0"
}

variable "aws_plugin_version" {
  description = "The image version of the velero/velero-plugin-for-aws image"
  type        = string
  default     = "v1.9.0"
}

variable "csi_plugin_version" {
  description = "The image version of the velero/velero-plugin-for-csi image"
  type        = string
  default     = "v0.7.0"
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "log_level" {
  description = "The log level for the Velero pods"
  type        = string
  default     = "warning"
  validation {
    condition     = contains(["info", "error", "fatal", "panic", "warning", "debug"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "monitoring_enabled" {
  description = "Whether to allow monitoring CRs to be deployed in the namespace"
  type        = bool
  default     = false
}
