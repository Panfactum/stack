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
  default     = "1.3.1"
}

variable "domain" {
  description = "The domain to access Airbyte (e.g., airbyte.example.com)"
  type        = string
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

variable "admin_email" {
  description = "Email for the admin user when auth is enabled"
  type        = string
}

variable "ingress_enabled" {
  description = "Whether to enable the ingress for Airbyte"
  type        = bool
  default     = true
}

variable "connector_builder_enabled" {
  description = "Whether to enable the connector builder server"
  type        = bool
  default     = false
}

variable "node_image_cached_enabled" {
  description = "Whether to enable node image caching"
  type        = bool
  default     = true
}

variable "vpa_enabled" {
  description = "Whether to enable Vertical Pod Autoscaler"
  type        = bool
  default     = true
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
variable "worker_replicas" {
  description = "Number of worker replicas"
  type        = number
  default     = 1
  validation {
    condition     = var.worker_replicas >= 1
    error_message = "The worker_replicas value must be at least 1."
  }
}

# Scheduler and node configuration
variable "panfactum_scheduler_enabled" {
  description = "Whether to enable the Panfactum scheduler"
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to enable pull-through cache for container images"
  type        = bool
  default     = true
}

variable "spot_nodes_enabled" {
  description = "Whether to allow scheduling on spot nodes"
  type        = bool
  default     = true
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow scheduling on burstable nodes"
  type        = bool
  default     = true
}

variable "controller_nodes_enabled" {
  description = "Whether to allow scheduling on controller nodes"
  type        = bool
  default     = true
}

variable "aws_iam_ip_allow_list" {
  description = "List of IPs to allow for AWS IAM access"
  type        = list(string)
  default     = []
}

variable "jobs_min_memory_mb" {
  description = "Memory request for jobs containers"
  type        = number
  default     = 1024
}

variable "jobs_cpu_request_millicores" {
  description = "CPU request for jobs containers"
  type        = number
  default     = 250
}

variable "jobs_env_env" {
  description = "Additional environment variables for Airbyte jobs configuration (e.g. SYNC_JOB_MAX_ATTEMPTS, JOB_MAIN_CONTAINER_MEMORY_LIMIT, etc.)"
  type        = map(string)
  default     = {}
}

variable "jobs_extra_env_vars" {
  description = "Environment variables to pass to Airbyte jobs"
  type = list(object({
    name = string
    value = optional(string)
    valueFrom = optional(object({
      secretKeyRef = optional(object({
        name = string
        key = string
      }))
      # Add other valueFrom options if needed
    }))
  }))
  default = []
}

variable "webapp_min_memory_mb" {
  description = "Memory request for webapp containers"
  type        = number
  default     = 512
}

variable "webapp_cpu_request_millicores" {
  description = "CPU request for webapp containers"
  type        = number
  default     = 200
}

variable "server_min_memory_mb" {
  description = "Memory request for server containers"
  type        = number
  default     = 512
}

variable "server_cpu_request_millicores" {
  description = "CPU request for server containers"
  type        = number
  default     = 200
}

variable "worker_min_memory_mb" {
  description = "Memory request for worker containers"
  type        = number
  default     = 512
}

variable "worker_cpu_request_millicores" {
  description = "CPU request for worker containers"
  type        = number
  default     = 200
}

variable "temporal_min_memory_mb" {
  description = "Memory request for temporal containers"
  type        = number
  default     = 512
}

variable "temporal_cpu_request_millicores" {
  description = "CPU request for temporal containers"
  type        = number
  default     = 200
}

variable "temporal_db_max_idle_conns" {
  description = "Maximum number of idle connections for Temporal database (SQL_MAX_IDLE_CONNS)"
  type        = number
  default     = 20
}

variable "temporal_db_max_conns" {
  description = "Maximum number of connections for Temporal database (SQL_MAX_CONNS)"
  type        = number
  default     = 100  # Higher than max_idle_conns, as recommended
  validation {
    condition     = var.temporal_db_max_conns >= var.temporal_db_max_idle_conns
    error_message = "temporal_db_max_conns must be greater than or equal to temporal_db_max_idle_conns"
  }
}

variable "connector_min_builder_memory_mb" {
  description = "Memory request for connector builder containers"
  type        = number
  default     = 256
}

variable "connector_builder_cpu_request_millicores" {
  description = "CPU request for connector builder containers"
  type        = number
  default     = 100
}

variable "pod_min_sweeper_memory_mb" {
  description = "Memory request for pod sweeper containers"
  type        = number
  default     = 128
}

variable "pod_sweeper_min_cpu_millicores" {
  description = "CPU request for pod sweeper containers"
  type        = number
  default     = 50
}

variable "cron_min_memory_mb" {
  description = "Memory request for cron containers"
  type        = number
  default     = 256
}

variable "cron_cpu_request_millicores" {
  description = "CPU request for cron containers"
  type        = number
  default     = 100
}

variable "workload_min_api_server_memory_mb" {
  description = "Memory request for workload API server containers"
  type        = number
  default     = 256
}

variable "workload_api_server_cpu_request_millicores" {
  description = "CPU request for workload API server containers"
  type        = number
  default     = 100
}

variable "workload_min_launcher_memory_mb" {
  description = "Memory request for workload launcher containers"
  type        = number
  default     = 256
}

variable "workload_launcher_cpu_request_millicores" {
  description = "CPU request for workload launcher containers"
  type        = number
  default     = 100
}

variable "pod_annotations" {
  description = "Additional pod annotations to add to all pods"
  type        = map(string)
  default     = {}
}

variable "vault_domain" {
  description = "The domain where Vault is accessible"
  type        = string
}

variable "additional_s3_bucket_arns" {
  description = "Additional S3 bucket ARNs to grant permissions to the Airbyte service account"
  type        = list(string)
  default     = []
}