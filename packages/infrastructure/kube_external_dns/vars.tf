variable "external_dns_helm_version" {
  description = "The version of the ExternalDNS helm chart to deploy"
  type        = string
  default     = "1.14.3"
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "route53_zones" {
  description = "A mapping of public DNS domains managed by AWS to their configuration; external-dns uses this to set domain records"
  type = map(object({
    record_manager_role_arn = string
    zone_id                 = string
  }))
  default = {}
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "sync_policy" {
  description = "How should ExternalDNS handle DNS record synchronization"
  type        = string
  default     = "upsert-only"
  validation {
    condition     = contains(["sync", "upsert-only", "create-only"], var.sync_policy)
    error_message = "sync_policy must be one of: sync, upsert-only, create-only"
  }
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "log_level" {
  description = "The log level for the ExternalDNS pods"
  type        = string
  default     = "warning"
  validation {
    condition     = contains(["info", "error", "fatal", "panic", "warning", "debug", "trace"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

