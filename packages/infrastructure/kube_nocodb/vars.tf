variable "namespace" {
  description = "Kubernetes namespace to deploy the resources into"
  type        = string
  default     = "nocodb"
}

variable "nocodb_version" {
  description = "The version of NocoDB to use"
  type        = string
  default     = "0.258.10"
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
  description = "The log level for the NocoDB pods"
  type        = string
  default     = "debug"
  validation {
    condition     = contains(["info", "error", "trace", "debug"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "ingress_enabled" {
  description = "Whether to enable ingress to the NocoDB server"
  type        = bool
  default     = false
}

variable "cdn_mode_enabled" {
  description = "Whether to enable CDN mode for the Vault ingress"
  type        = bool
  default     = true
}

variable "domain" {
  description = "The domain from which NocoDB will serve traffic"
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

variable "db_recovery_target_time" {
  description = "If provided, will recover the PostgreSQL database to the indicated target time in RFC 3339 format rather than to the latest data."
  type        = string
  default     = null
}

variable "superuser_email" {
  description = "The email address to use for the root NocoDB administrator. Warning: must be changed manually once applied."
  type        = string
}

variable "auth_expires_hours" {
  description = "How many hours that users' authentication is valid before expiring and requiring a new login."
  type        = number
  default     = 10
}

variable "attachment_max_size_mb" {
  description = "The maximum file size allowed for attachments in MB."
  type        = number
  default     = 20
}

variable "attachment_max_allowed" {
  description = "The maximum number of attachments allowed per cell."
  type        = number
  default     = 10
}

variable "secure_attachments_enabled" {
  description = "Enables access to attachments only through pre-signed URLs."
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
