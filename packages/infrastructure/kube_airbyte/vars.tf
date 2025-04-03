variable "namespace" {
  description = "The namespace to deploy Airbyte into"
  type        = string
  default     = "airbyte"
}

variable "helm_timeout_seconds" {
  description = "The timeout in seconds for Helm operations"
  type        = number
  default     = 600
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
  default     = "1.5.1"
}

variable "airbyte_version" {
  description = "The version of Airbyte to deploy (for image caching)"
  type        = string
  default     = "1.5.1"
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
  default     = "WARN"
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

variable "pg_min_memory_mb" {
  description = "The minimum amount of memory to allocate to the postgres pods (in Mi)"
  type        = number
  default     = 500

  validation {
    condition     = var.pg_min_memory_mb >= 500
    error_message = "Must provide at least 500MB of memory"
  }
}

variable "pg_max_memory_mb" {
  description = "The maximum amount of memory to allocate to the postgres pods (in Mi)"
  type        = number
  default     = 128000
}

variable "pg_min_cpu_millicores" {
  description = "The minimum amount of cpu to allocate to the postgres pods (in millicores)"
  type        = number
  default     = 50

  validation {
    condition     = var.pg_min_cpu_millicores >= 50
    error_message = "Must provide at least 50m of CPU"
  }
}

variable "pg_max_cpu_millicores" {
  description = "The maximum amount of cpu to allocate to the postgres pods (in millicores)"
  type        = number
  default     = 10000
}

variable "pg_min_cpu_update_millicores" {
  description = "The CPU settings for the Postgres won't be updated until the recommendations from the VPA (if enabled) differ from the current settings by at least this many millicores. This prevents autoscaling thrash."
  type        = number
  default     = 250
}

variable "pgbouncer_min_memory_mb" {
  description = "The minimum amount of memory to allocate to the pgbouncer pods (in Mi)"
  type        = number
  default     = 25

  validation {
    condition     = var.pgbouncer_min_memory_mb >= 25
    error_message = "Must provide at least 25MB of memory"
  }
}

variable "pgbouncer_max_memory_mb" {
  description = "The maximum amount of memory to allocate to the pgbouncer pods (in Mi)"
  type        = number
  default     = 32000
}

variable "pgbouncer_min_cpu_millicores" {
  description = "The minimum amount of cpu to allocate to the pgbouncer pods (in millicores)"
  type        = number
  default     = 15

  validation {
    condition     = var.pgbouncer_min_cpu_millicores >= 10
    error_message = "Must provide at least 10m of CPU"
  }
}

variable "pgbouncer_max_cpu_millicores" {
  description = "The maximum amount of cpu to allocate to the pgbouncer pods (in millicores)"
  type        = number
  default     = 10000
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

variable "arm_nodes_enabled" {
  description = "Whether to allow scheduling on arm nodes"
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
  default     = false
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

variable "jobs_cpu_min_millicores" {
  description = "The minimum amount of cpu millicores for jobs containers"
  type        = number
  default     = 100
}

variable "global_env" {
  description = "Additional global environment variables for Airbyte configuration https://docs.airbyte.com/operator-guides/configuring-airbyte"
  type        = map(string)
  default     = {}
}

variable "jobs_sync_job_retries_complete_failures_max_successive" {
  description = "Defines the max number of successive attempts in which no data was synchronized before failing the job."
  type        = number
  default     = 3
}

variable "jobs_sync_job_retries_complete_failures_max_total" {
  description = "Defines the max number of attempts in which no data was synchronized before failing the job."
  type        = number
  default     = 9
}

variable "jobs_sync_job_retries_complete_failures_backoff_min_interval_s" {
  description = "Defines the minimum backoff interval in seconds between failed attempts in which no data was synchronized."
  type        = number
  default     = 60
}

variable "jobs_sync_job_retries_complete_failures_backoff_max_interval_s" {
  description = "Defines the maximum backoff interval in seconds between failed attempts in which no data was synchronized."
  type        = number
  default     = 3600
}

variable "jobs_sync_job_retries_complete_failures_backoff_base" {
  description = "Defines the exponential base of the backoff interval between failed attempts in which no data was synchronized."
  type        = number
  default     = 2
}

variable "jobs_sync_job_retries_partial_failures_max_successive" {
  description = "Defines the max number of attempts in which some data was synchronized before failing the job."
  type        = number
  default     = 3
}

variable "jobs_sync_job_retries_partial_failures_max_total" {
  description = "Defines the max number of attempts in which some data was synchronized before failing the job."
  type        = number
  default     = 9
}

variable "jobs_sync_max_timeout_days" {
  description = "Defines the number of days a sync job will execute for before timing out."
  type        = number
  default     = 1
}

variable "webapp_min_memory_mb" {
  description = "Memory request for webapp containers"
  type        = number
  default     = 128
}

variable "webapp_min_cpu_millicores" {
  description = "The minimum amount of cpu millicores webapp containers"
  type        = number
  default     = 50
}

variable "server_min_memory_mb" {
  description = "Memory request for server containers"
  type        = number
  default     = 512
}

variable "server_min_cpu_millicores" {
  description = "The minimum amount of cpu millicores for server containers"
  type        = number
  default     = 50
}

variable "worker_min_memory_mb" {
  description = "Memory request for worker containers"
  type        = number
  default     = 512
}

variable "worker_min_cpu_millicores" {
  description = "The minimum amount of cpu millicores for worker containers"
  type        = number
  default     = 100
}

variable "temporal_min_memory_mb" {
  description = "Memory request for temporal containers"
  type        = number
  default     = 512
}

variable "temporal_min_cpu_millicores" {
  description = "The minimum amount of cpu millicores for temporal containers"
  type        = number
  default     = 150
}

variable "temporal_db_max_idle_conns" {
  description = "Maximum number of idle connections for Temporal database (SQL_MAX_IDLE_CONNS)"
  type        = number
  default     = 20
}

variable "temporal_db_max_conns" {
  description = "Maximum number of connections for Temporal database (SQL_MAX_CONNS)"
  type        = number
  default     = 100 # Higher than max_idle_conns, as recommended
}

variable "connector_min_builder_memory_mb" {
  description = "Memory request for connector builder containers"
  type        = number
  default     = 300
}

variable "connector_builder_min_cpu_millicores" {
  description = "The minimum amount of cpu millicores for connector builder containers"
  type        = number
  default     = 25
}

variable "pod_min_sweeper_memory_mb" {
  description = "Memory request for pod sweeper containers"
  type        = number
  default     = 32
}

variable "pod_sweeper_min_cpu_millicores" {
  description = "The minimum amount of cpu millicores for pod sweeper containers"
  type        = number
  default     = 10
}

variable "cron_min_memory_mb" {
  description = "Memory request for cron containers"
  type        = number
  default     = 368
}

variable "cron_min_cpu_millicores" {
  description = "The minimum amount of cpu millicores for cron containers"
  type        = number
  default     = 25
}

variable "workload_api_min_server_memory_mb" {
  description = "Memory request for workload API server containers"
  type        = number
  default     = 325
}

variable "workload_api_server_min_cpu_millicores" {
  description = "The minimum amount of cpu millicores for workload API server containers"
  type        = number
  default     = 25
}

variable "workload_min_launcher_memory_mb" {
  description = "Memory request for workload launcher containers"
  type        = number
  default     = 350
}

variable "workload_launcher_min_cpu_millicores" {
  description = "The minimum amount of cpu millicores for workload launcher containers"
  type        = number
  default     = 25
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

variable "connected_s3_bucket_arns" {
  description = "List of S3 bucket ARNs that airbyte will use as connector destinations"
  type        = list(string)
  default     = []
}