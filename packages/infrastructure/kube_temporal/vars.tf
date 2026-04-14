# Panfactum standard variables
variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "vpa_enabled" {
  description = "Whether to create VPA resources"
  type        = bool
  default     = true
}

variable "monitoring_enabled" {
  description = "Whether to enable Prometheus monitoring CRs"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to use ECR pull-through cache for images"
  type        = bool
  default     = true
}

variable "panfactum_scheduler_enabled" {
  description = "Use Panfactum custom scheduler"
  type        = bool
  default     = true
}

variable "log_level" {
  description = "Temporal server log level"
  type        = string
  default     = "info"
  validation {
    condition     = contains(["debug", "info", "warn", "error"], var.log_level)
    error_message = "log_level must be one of: debug, info, warn, error."
  }
}

# Scheduling variables (passed to kube_workload_utility and kube_deployment)
variable "spot_nodes_enabled" {
  description = "Whether the database pods can be scheduled on spot nodes"
  type        = bool
  default     = true
}

variable "burstable_nodes_enabled" {
  description = "Whether the database pods can be scheduled on burstable nodes"
  type        = bool
  default     = true
}

variable "arm_nodes_enabled" {
  description = "Whether the database pods can be scheduled on arm64 nodes"
  type        = bool
  default     = true
}

variable "controller_nodes_enabled" {
  description = "Whether to allow pods to schedule on EKS Node Group nodes (controller nodes)"
  type        = bool
  default     = false
}

# Disruption
variable "voluntary_disruptions_enabled" {
  description = "Whether to enable voluntary disruptions of pods in this module"
  type        = bool
  default     = true
}

variable "voluntary_disruption_window_enabled" {
  description = "Whether to confine voluntary disruptions of pods in this module to specific time windows"
  type        = bool
  default     = false
}

variable "voluntary_disruption_window_seconds" {
  description = "The length of the disruption window in seconds"
  type        = number
  default     = 900
}

# PostgreSQL variables (passed to kube_pg_cluster)
variable "pg_instances" {
  description = "Number of DB replicas (use sla_target for default)"
  type        = number
  default     = 2
}

variable "pg_minimum_memory_mb" {
  description = "The minimum amount of memory to allocate to the postgres pods (in MB)"
  type        = number
  default     = 500
}

variable "pg_maximum_memory_mb" {
  description = "The maximum amount of memory to allocate to the postgres pods (in MB)"
  type        = number
  default     = 128000
}

variable "pg_minimum_cpu_millicores" {
  description = "The minimum amount of cpu to allocate to the postgres pods (in millicores)"
  type        = number
  default     = 50
}

variable "pg_maximum_cpu_millicores" {
  description = "The maximum amount of cpu to allocate to the postgres pods (in millicores)"
  type        = number
  default     = 10000
}

variable "pg_initial_storage_gb" {
  description = "How many GB to initially allocate for persistent storage (will grow automatically as needed). Can only be set on cluster creation."
  type        = number
  default     = 10
}

variable "pg_storage_limit_gb" {
  description = "The maximum number of gigabytes of storage to provision for the PostgreSQL database"
  type        = number
  default     = null
}

# Temporal-specific variables
variable "num_history_shards" {
  description = "Number of Temporal history shards. WARNING: This value is set once during schema initialization and can NEVER be changed without a full data migration. 512 is appropriate for most workloads."
  type        = number
  default     = 512
  validation {
    condition     = var.num_history_shards > 0
    error_message = "num_history_shards must be greater than 0. WARNING: This value cannot be changed after initial deployment."
  }
}

variable "default_namespace_retention_days" {
  description = "Retention period in days for the auto-created 'default' Temporal namespace."
  type        = number
  default     = 7
  validation {
    condition     = var.default_namespace_retention_days > 0
    error_message = "default_namespace_retention_days must be greater than 0."
  }
}

# Replica counts for server services (SLA-aware)
variable "frontend_replicas" {
  description = "Number of replicas. Defaults to 2 if sla_target >= 2, else 1."
  type        = number
  default     = null
}

variable "history_replicas" {
  description = "Number of replicas. Defaults to 2 if sla_target >= 2, else 1."
  type        = number
  default     = null
}

variable "matching_replicas" {
  description = "Number of replicas. Defaults to 2 if sla_target >= 2, else 1."
  type        = number
  default     = null
}

variable "worker_replicas" {
  description = "Number of replicas. Defaults to 2 if sla_target >= 2, else 1."
  type        = number
  default     = null
}

# Web UI / Ingress
variable "ingress_enabled" {
  description = "Whether to enable the ingress for routing traffic to the Temporal Web UI"
  type        = bool
  default     = true
}

variable "ingress_domains" {
  description = "Domains for the Temporal Web UI Ingress."
  type        = list(string)
  validation {
    condition     = !var.ingress_enabled || length(var.ingress_domains) > 0
    error_message = "ingress_domains must be non-empty when ingress_enabled is true."
  }
}

# CDN
variable "cdn_mode_enabled" {
  description = "Whether to enable CDN mode for the Temporal UI ingress"
  type        = bool
  default     = true
}

# Authentication
variable "vault_domain" {
  description = "The domain of the Vault instance to use for OIDC authentication on the Temporal UI"
  type        = string
}

variable "allowed_vault_roles" {
  description = "Vault roles allowed to access the Temporal UI"
  type        = set(string)
  default     = ["rbac-superusers", "rbac-admins", "rbac-readers", "rbac-restricted-readers"]
}