variable "namespace" {
  description = "The namespace to deploy Airbyte into"
  type        = string
  default     = "airbyte"
}

variable "airbyte_edition" {
  description = "The edition of Airbyte to deploy (community or enterprise)"
  type        = string
  default     = "community"
  validation {
    condition     = contains(["community", "enterprise"], var.airbyte_edition)
    error_message = "The airbyte_edition value must be either 'community' or 'enterprise'."
  }
}

variable "airbyte_helm_version" {
  description = "The version of the Airbyte Helm chart to deploy"
  type        = string
  default     = "1.3.1"
}

variable "airbyte_version" {
  description = "The version of Airbyte to deploy (for image caching)"
  type        = string
  default     = "latest"
}

variable "domain" {
  description = "The domain to access Airbyte (e.g., airbyte.example.com)"
  type        = string
  default     = ""
}

variable "wait" {
  description = "Whether to wait for resources to be created before completing"
  type        = bool
  default     = true
}

variable "sla_target" {
  description = "SLA target level (1-3) affecting high availability settings"
  type        = number
  default     = 1
  validation {
    condition     = var.sla_target >= 1 && var.sla_target <= 3
    error_message = "The sla_target value must be between 1 and 3."
  }
}

variable "auth_enabled" {
  description = "Whether to enable authentication for Airbyte"
  type        = bool
  default     = false
}

variable "admin_email" {
  description = "Email for the admin user when auth is enabled"
  type        = string
  default     = "admin@example.com"
}

variable "admin_first_name" {
  description = "First name for the admin user when auth is enabled"
  type        = string
  default     = "Admin"
}

variable "admin_last_name" {
  description = "Last name for the admin user when auth is enabled"
  type        = string
  default     = "User"
}

variable "ingress_enabled" {
  description = "Whether to enable the ingress for Airbyte"
  type        = bool
  default     = true
}

variable "cdn_mode_enabled" {
  description = "Whether to enable CDN mode for the ingress"
  type        = bool
  default     = false
}

variable "connector_builder_enabled" {
  description = "Whether to enable the connector builder server"
  type        = bool
  default     = true
}

variable "node_image_cached_enabled" {
  description = "Whether to enable node image caching"
  type        = bool
  default     = false
}

variable "vpa_enabled" {
  description = "Whether to enable Vertical Pod Autoscaler"
  type        = bool
  default     = false
}

variable "monitoring_enabled" {
  description = "Whether to enable monitoring for Airbyte"
  type        = bool
  default     = false
}

variable "log_level" {
  description = "The log level for Airbyte components"
  type        = string
  default     = "INFO"
  validation {
    condition     = contains(["DEBUG", "INFO", "WARN", "ERROR"], var.log_level)
    error_message = "The log_level must be one of: DEBUG, INFO, WARN, ERROR."
  }
}

variable "license_key" {
  description = "License key for Airbyte Enterprise"
  type        = string
  default     = ""
  sensitive   = true
}

# S3 Storage Configuration (required for AWS deployments)

variable "aws_region" {
  description = "The AWS region to use for S3"
  type        = string
  default     = "us-east-1"
}

# External DB Configuration is removed as we always use kube_pg_cluster

# Database backup/restore options for internal PostgreSQL
variable "pg_initial_storage_gb" {
  description = "The initial storage for PostgreSQL in GB"
  type        = number
  default     = 20
}

variable "db_backup_directory" {
  description = "Directory to store database backups (if enabled)"
  type        = string
  default     = "initial"
}

variable "db_recovery_mode_enabled" {
  description = "Whether to enable recovery mode for the database"
  type        = bool
  default     = false
}

variable "db_recovery_directory" {
  description = "Directory to restore database from (if recovery mode enabled)"
  type        = string
  default     = null
}

variable "db_recovery_target_time" {
  description = "Target recovery time for the database (if recovery mode enabled)"
  type        = string
  default     = null
}

# Component replicas
variable "webapp_replicas" {
  description = "Number of webapp replicas"
  type        = number
  default     = 1
  validation {
    condition     = var.webapp_replicas >= 1
    error_message = "The webapp_replicas value must be at least 1."
  }
}

variable "server_replicas" {
  description = "Number of server replicas"
  type        = number
  default     = 1
  validation {
    condition     = var.server_replicas >= 1
    error_message = "The server_replicas value must be at least 1."
  }
}

variable "worker_replicas" {
  description = "Number of worker replicas"
  type        = number
  default     = 1
  validation {
    condition     = var.worker_replicas >= 1
    error_message = "The worker_replicas value must be at least 1."
  }
}

variable "temporal_replicas" {
  description = "Number of temporal replicas"
  type        = number
  default     = 1
  validation {
    condition     = var.temporal_replicas >= 1
    error_message = "The temporal_replicas value must be at least 1."
  }
}

# Scheduler and node configuration
variable "panfactum_scheduler_enabled" {
  description = "Whether to enable the Panfactum scheduler"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to enable pull-through cache for container images"
  type        = bool
  default     = false
}

variable "spot_nodes_enabled" {
  description = "Whether to allow scheduling on spot nodes"
  type        = bool
  default     = false
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow scheduling on burstable nodes"
  type        = bool
  default     = false
}

variable "controller_nodes_enabled" {
  description = "Whether to allow scheduling on controller nodes"
  type        = bool
  default     = false
}

variable "aws_iam_ip_allow_list" {
  description = "List of IPs to allow for AWS IAM access"
  type        = list(string)
  default     = []
}

# Resource configurations
variable "webapp_memory_request" {
  description = "Memory request for webapp containers"
  type        = string
  default     = "512Mi"
}

variable "webapp_memory_limit" {
  description = "Memory limit for webapp containers"
  type        = string
  default     = "1Gi"
}

variable "webapp_cpu_request" {
  description = "CPU request for webapp containers"
  type        = string
  default     = "200m"
}

variable "webapp_cpu_limit" {
  description = "CPU limit for webapp containers"
  type        = string
  default     = "500m"
}

variable "server_memory_request" {
  description = "Memory request for server containers"
  type        = string
  default     = "512Mi"
}

variable "server_memory_limit" {
  description = "Memory limit for server containers"
  type        = string
  default     = "1Gi"
}

variable "server_cpu_request" {
  description = "CPU request for server containers"
  type        = string
  default     = "200m"
}

variable "server_cpu_limit" {
  description = "CPU limit for server containers"
  type        = string
  default     = "500m"
}

variable "worker_memory_request" {
  description = "Memory request for worker containers"
  type        = string
  default     = "512Mi"
}

variable "worker_memory_limit" {
  description = "Memory limit for worker containers"
  type        = string
  default     = "1Gi"
}

variable "worker_cpu_request" {
  description = "CPU request for worker containers"
  type        = string
  default     = "200m"
}

variable "worker_cpu_limit" {
  description = "CPU limit for worker containers"
  type        = string
  default     = "500m"
}

variable "temporal_memory_request" {
  description = "Memory request for temporal containers"
  type        = string
  default     = "512Mi"
}

variable "temporal_memory_limit" {
  description = "Memory limit for temporal containers"
  type        = string
  default     = "1Gi"
}

variable "temporal_cpu_request" {
  description = "CPU request for temporal containers"
  type        = string
  default     = "200m"
}

variable "temporal_cpu_limit" {
  description = "CPU limit for temporal containers"
  type        = string
  default     = "500m"
}

variable "pod_annotations" {
  description = "Additional pod annotations to add to all pods"
  type        = map(string)
  default     = {}
}

variable "node_selector" {
  description = "Node selector for Airbyte pods"
  type        = map(string)
  default     = {}
}

variable "tolerations" {
  description = "Tolerations for Airbyte pods"
  type = list(object({
    key               = string
    operator          = string
    value             = optional(string)
    effect            = string
    tolerationSeconds = optional(number)
  }))
  default = []
}