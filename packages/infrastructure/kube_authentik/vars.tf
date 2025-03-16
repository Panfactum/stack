variable "namespace" {
  description = "Kubernetes namespace to deploy the resources into"
  type        = string
  default     = "authentik"
}

variable "authentik_helm_version" {
  description = "The version of the Authentik helm chart to deploy"
  type        = string
  default     = "2024.8.4"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "log_level" {
  description = "The log level for the Authentik pods"
  type        = string
  default     = "debug"
  validation {
    condition     = contains(["info", "error", "trace", "debug"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "error_reporting_enabled" {
  description = "True iff errors should be reported to Authentik for telemetry purposes"
  type        = bool
  default     = true
}


variable "ingress_enabled" {
  description = "Whether to enable ingress to the Authentik server"
  type        = bool
  default     = false
}

variable "cdn_mode_enabled" {
  description = "Whether to enable CDN mode for the Vault ingress"
  type        = bool
  default     = true
}

variable "domain" {
  description = "A list of domains from which authentik will serve traffic"
  type        = string
  default     = null
}

variable "smtp_user" {
  description = "The user to use for SMTP authentication for email sending"
  type        = string
}

variable "smtp_password" {
  description = "The password to use for SMTP authentication for email sending"
  type        = string
  sensitive   = true
}

variable "smtp_host" {
  description = "The SMTP server for email sending"
  type        = string
}

variable "email_from_address" {
  description = "The 'from' address to use for sent emails"
  type        = string
}

variable "akadmin_email" {
  description = "The email address to use for the root authentik administrator. Warning: must be changed manually once applied."
  type        = string
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}

variable "sla_target" {
  description = "The Panfactum SLA level for the module deployment. 1 = lowest uptime (99.9%), lowest cost -- 3 = highest uptime (99.999%), highest Cost"
  type        = number
  default     = 3

  validation {
    condition     = var.sla_target <= 3 && var.sla_target >= 1
    error_message = "sla_target must be one of: 1, 2, 3"
  }
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "db_recovery_mode_enabled" {
  description = "Whether to enable recovery mode for the PostgreSQL database"
  type        = bool
  default     = false
}

variable "db_recovery_directory" {
  description = "The name of the directory in the backup bucket that contains the PostgreSQL backups and WAL archives"
  type        = string
  default     = null
}

variable "db_backup_directory" {
  description = "The name of the directory in the backup bucket containing the backups files."
  type        = string
  default     = "initial"
}

variable "db_recovery_target_time" {
  description = "If provided, will recover the PostgreSQL database to the indicated target time in RFC 3339 format rather than to the latest data."
  type        = string
  default     = null
}

variable "node_image_cached_enabled" {
  description = "Whether to add the container images to the node image cache for faster startup times"
  type        = bool
  default     = true
}

variable "wait" {
  description = "Wait for resources to be in a ready state before proceeding. Disabling this flag will allow upgrades to proceed faster but will disable automatic rollbacks. As a result, manual intervention may be required for deployment failures."
  type        = bool
  default     = true
}

variable "spot_nodes_enabled" {
  description = "Whether to allow pods to schedule on spot nodes"
  type        = bool
  default     = true
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow pods to schedule on burstable nodes"
  type        = bool
  default     = true
}

variable "controller_nodes_enabled" {
  description = "Whether to allow pods to schedule on EKS Node Group nodes (controller nodes)"
  type        = bool
  default     = true
}
