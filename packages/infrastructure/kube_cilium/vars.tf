variable "cilium_helm_version" {
  description = "The version of the metrics-server helm chart to deploy"
  type        = string
  default     = "1.15.2"
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "eks_cluster_url" {
  description = "The url of the EKS cluster api server"
  type        = string
}

variable "log_level" {
  description = "The log level for the Cilium pods"
  type        = string
  default     = "warn"
  validation {
    condition     = contains(["info", "error", "debug", "warn"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
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

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}

variable "hubble_enabled" {
  description = "Whether to enable hubble for network debugging"
  type        = bool
  default     = false
}
