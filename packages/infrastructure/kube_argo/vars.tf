variable "argo_helm_version" {
  description = "The version of the argo helm chart to deploy"
  type        = string
  default     = "0.41.1"
}

variable "argo_domain" {
  description = "The domain to use for the argo UI. Must be in a subdomain available to the environment."
  type        = string
}

variable "vault_domain" {
  description = "The domain of the Vault instance running in the cluster."
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "ingress_enabled" {
  description = "Whether or not to enable the ingress for routing traffic to argo"
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "log_level" {
  description = "The log level for the argo pods"
  type        = string
  default     = "info"
  validation {
    condition     = contains(["info", "error", "warn", "debug"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster that contains the service account."
  type        = string
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "workflow_archive_ttl" {
  description = "Length of time that previously run workflow states are stored"
  type        = string
  default     = "60d"
}

variable "workflow_archive_backups_enabled" {
  description = "Whether to enable backups of the workflow archives"
  type        = bool
  default     = false
}
