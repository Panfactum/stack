variable "argo_workflows_helm_version" {
  description = "The version of the argo workflows helm chart to deploy"
  type        = string
  default     = "0.45.1"
}

variable "argo_events_helm_version" {
  description = "The version of the argo events helm chart to deploy"
  type        = string
  default     = "2.4.9"
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
  default     = true
}

variable "ingress_enabled" {
  description = "Whether or not to enable the ingress for routing traffic to argo"
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "node_image_cache_enabled" {
  description = "Whether to cache images locally for better startup performance"
  type        = bool
  default     = true
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
  validation {
    condition     = !strcontains(tostring(var.sla_target), ".")
    error_message = "sla_target must be one of: 1, 2, 3"
  }
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}

variable "test_workflow_enabled" {
  description = "Whether to enable the test WorkflowTemplate"
  type        = bool
  default     = false
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

variable "pg_minimum_memory_mb" {
  description = "The minimum amount of memory to allocate to the postgres pods (in Mi)"
  type        = number
  default     = 400

  validation {
    condition     = var.pg_minimum_memory_mb >= 400
    error_message = "Must provide at least 400MB of memory"
  }
}

variable "pg_maximum_memory_mb" {
  description = "The maximum amount of memory to allocate to the postgres pods (in Mi)"
  type        = number
  default     = 128000
}

variable "pg_minimum_cpu_millicores" {
  description = "The minimum amount of cpu to allocate to the postgres pods (in millicores)"
  type        = number
  default     = 50

  validation {
    condition     = var.pg_minimum_cpu_millicores >= 50
    error_message = "Must provide at least 50m of CPU"
  }
}

variable "pg_maximum_cpu_millicores" {
  description = "The maximum amount of cpu to allocate to the postgres pods (in millicores)"
  type        = number
  default     = 10000
}

variable "pg_minimum_cpu_update_millicores" {
  description = "The CPU settings for the Postgres won't be updated until the recommendations from the VPA (if enabled) differ from the current settings by at least this many millicores. This prevents autoscaling thrash."
  type        = number
  default     = 250
}

variable "pgbouncer_minimum_memory_mb" {
  description = "The minimum amount of memory to allocate to the pgbouncer pods (in Mi)"
  type        = number
  default     = 25

  validation {
    condition     = var.pgbouncer_minimum_memory_mb >= 25
    error_message = "Must provide at least 25MB of memory"
  }
}

variable "pgbouncer_maximum_memory_mb" {
  description = "The maximum amount of memory to allocate to the pgbouncer pods (in Mi)"
  type        = number
  default     = 32000
}

variable "pgbouncer_minimum_cpu_millicores" {
  description = "The minimum amount of cpu to allocate to the pgbouncer pods (in millicores)"
  type        = number
  default     = 15

  validation {
    condition     = var.pgbouncer_minimum_cpu_millicores >= 10
    error_message = "Must provide at least 10m of CPU"
  }
}

variable "pgbouncer_maximum_cpu_millicores" {
  description = "The maximum amount of cpu to allocate to the pgbouncer pods (in millicores)"
  type        = number
  default     = 10000
}
