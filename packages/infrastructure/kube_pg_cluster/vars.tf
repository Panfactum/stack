variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
}

variable "pg_cluster_namespace" {
  description = "The namespace to deploy to the cluster into"
  type        = string
}

variable "pg_version" {
  description = "The version of postgres to deploy"
  type        = string
  default     = "16.2-10"
}

variable "pg_instances" {
  description = "The number of instances to deploy in the postgres cluster"
  type        = number
  default     = 2
}

variable "pg_storage_gb" {
  description = "The initial number of gigabytes of storage to provision for the postgres cluster"
  type        = number
}

variable "pg_storage_limit_gb" {
  description = "The maximum number of gigabytes of storage to provision for the postgres cluster"
  type        = number
  default     = null
}

variable "pg_storage_increase_threshold_percent" {
  description = "Dropping below this percent of free storage will trigger an automatic increase in storage size"
  type        = number
  default     = 20
}

variable "pg_storage_increase_percent" {
  description = "The percent to increase storage by if free space drops below the threshold"
  type        = number
  default     = 100
}

variable "pg_shutdown_timeout" {
  description = "The number of seconds to wait for open connections to close before shutting down postgres nodes"
  type        = number
  default     = null
}

variable "backups_force_delete" {
  description = "Whether to delete backups on destroy"
  type        = bool
  default     = false
}

variable "vpa_enabled" {
  description = "Whether to enable the vertical pod autoscaler"
  type        = bool
  default     = true
}

variable "backups_enabled" {
  description = "Whether this database has backups enabled"
  type        = bool
  default     = true
}

variable "spot_instances_enabled" {
  description = "Whether the database nodes can be scheduled on spot instances"
  type        = bool
  default     = false
}

variable "burstable_instances_enabled" {
  description = "Whether the database nodes can be scheduled on burstable instances"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "pg_memory_mb" {
  description = "The amount of memory to allocate to the postgres pods (in Mi)"
  type        = number
  default     = 1000
}

variable "pg_cpu_millicores" {
  description = "The amount of cpu to allocate to the postgres pods (in millicores)"
  type        = number
  default     = 250
}

variable "log_connections_enabled" {
  description = "Whether to log each connection"
  type        = bool
  default     = false
}

variable "pgbouncer_version" {
  description = "The version of the cloudnative-pg/pgbouncer image to use"
  type        = string
  default     = "1.22.1"
}

variable "pgbouncer_pool_mode" {
  description = "What pool_mode to run pgbouncer in"
  type        = string
  default     = "session"
  validation {
    condition     = contains(["session", "transaction", "statement"], var.pgbouncer_pool_mode)
    error_message = "pool_mode must be one of: session, transaction, or statement"
  }
}

variable "pg_bouncer_read_only_enabled" {
  description = "Whether to enable a pgbouncer deployment in read-only mode"
  type        = bool
  default     = false
}

variable "pg_bouncer_read_write_enabled" {
  description = "Whether to enable a pgbouncer deployment in read-write mode"
  type        = bool
  default     = true
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}