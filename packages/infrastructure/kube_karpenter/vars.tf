variable "karpenter_helm_version" {
  description = "The version of the karpenter helm chart to deploy"
  type        = string
  default     = "0.37.0"
}

variable "cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "node_role_arn" {
  description = "The arn of the role the EKS cluster roles are assigned"
  type        = string
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

variable "log_level" {
  description = "The log level for the karpenter pods"
  type        = string
  default     = "warn"
  validation {
    condition     = contains(["info", "error", "warn", "debug"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}
