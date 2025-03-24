variable "namespace" {
  description = "Kubernetes namespace to deploy the resources into"
  type        = string
  default     = "grist"
}

variable "grist_version" {
  description = "The version of Grist to use"
  type        = string
  default     = "1.3.2"
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
  description = "The log level for the Grist pods"
  type        = string
  default     = "debug"
  validation {
    condition     = contains(["info", "error", "trace", "debug"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "ingress_enabled" {
  description = "Whether to enable ingress to the Grist server"
  type        = bool
  default     = true
}

variable "cdn_mode_enabled" {
  description = "Whether to enable CDN mode for the Vault ingress"
  type        = bool
  default     = true
}

variable "domain" {
  description = "The domain from which Grist will serve traffic"
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

variable "root_email" {
  description = "The email address to use for the root Grist administrator. Warning: must be changed manually once applied."
  type        = string
}

variable "organization_name" {
  description = "Name of the organization to set up in Grist."
  type        = string
}

variable "telemetry_enabled" {
  description = "Whether usage data will be reported to Grist for product-improvement purposes."
  type        = bool
  default     = true
}

variable "hidden_ui_elements" {
  description = "UI elements to hide. See GRIST_HIDE_UI_ELEMENTS."
  type        = list(string)
  default = [
    "billing",
    "createSite",
    "multiSite"
  ]

  validation {
    condition     = alltrue([for el in var.hidden_ui_elements : contains(["helpCenter", "billing", "templates", "createSite", "multiSite", "multiAccount", "sendToDrive", "tutorials", "supportGrist"], el)])
    error_message = "Unrecognized UI element in hidden_ui_elements"
  }
}

variable "action_history_max_rows" {
  description = "Maximum number of rows allowed in ActionHistory before pruning."
  type        = number
  default     = 1000

  validation {
    condition     = var.action_history_max_rows >= 1000
    error_message = "action_history_max_rows must be at least 1,000 to prevent issues with copying."
  }
}

variable "action_history_max_gb" {
  description = "Maximum number of gigabytes allowed in ActionHistory before pruning."
  type        = number
  default     = 1

  validation {
    condition     = var.action_history_max_gb >= 1
    error_message = "action_history_max_gb must be at least 1 to prevent issues with copying."
  }
}

variable "geo_restriction_type" {
  description = "What type of geographic restrictions to you want to apply to CDN clients"
  type        = string
  default     = "none"
  validation {
    condition     = contains(["whitelist", "blacklist", "none"], var.geo_restriction_type)
    error_message = "geo_restriction_type must be one of: whitelist, blacklist, none"
  }
}

variable "geo_restriction_list" {
  description = "A list of ISO 3166 country codes for the geographic restriction list (works for both whitelist and blacklist)"
  type        = list(string)
  default     = []
}

variable "session_max_length_hours" {
  description = "The max length of the user session before requiring re-authentication."
  type        = number
  default     = 16
}

variable "debug_logs_enabled" {
  description = "Whether debug logs are enabled."
  type        = bool
  default     = false
}

variable "vault_domain" {
  description = "The domain of the Vault instance running in the cluster."
  type        = string
}

variable "minimum_memory_mb" {
  description = "The memory floor for the Grist servers (in MB)."
  type        = number
  default     = 300

  validation {
    condition     = var.minimum_memory_mb >= 300
    error_message = "Grist requires at least 300 MB of memory to run."
  }
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