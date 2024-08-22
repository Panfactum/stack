variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "namespace" {
  description = "The namespace to deploy to the redis instances into"
  type        = string
}

variable "helm_version" {
  description = "The version of the bitnami/redis helm chart to use"
  type        = string
  default     = "19.0.2"
}

variable "persistence_size_gb" {
  description = "How many GB to initially allocate for persistent storage (will grow automatically as needed)"
  type        = number
  default     = 1
}

variable "persistence_storage_limit_gb" {
  description = "The maximum number of gigabytes of storage to provision for each redis node"
  type        = number
  default     = null
}

variable "persistence_storage_increase_threshold_percent" {
  description = "Dropping below this percent of free storage will trigger an automatic increase in storage size"
  type        = number
  default     = 20
}

variable "persistence_storage_increase_gb" {
  description = "The amount of GB to increase storage by if free space drops below the threshold"
  type        = number
  default     = 1
}

variable "persistence_backups_enabled" {
  description = "Whether to enable backups of the Redis durable storage."
  type        = bool
  default     = true
}

variable "replica_count" {
  description = "The number of redis replicas to deploy"
  type        = number
  default     = 3

  validation {
    condition     = var.replica_count >= 3
    error_message = "You must use at least three replicas for high-availability"
  }
}

variable "redis_flags" {
  description = "Extra configuration flags to pass to each redis node"
  type        = list(string)
  default     = []
}

variable "redis_save" {
  description = "Sets the save option for periodic snapshotting"
  type        = string
  default     = "300 100" # Every 5 min if at least 100 keys have changed
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

variable "arm_instances_enabled" {
  description = "Whether the database nodes can be scheduled on arm64 instances"
  type        = bool
  default     = false
}

variable "lfu_cache_enabled" {
  description = "Whether redis will be deployed as an LFU cache"
  type        = bool
  default     = false
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "minimum_memory_mb" {
  description = "The minimum memory in Mb to use for the redis nodes"
  type        = number
  default     = 25

  validation {
    condition     = var.minimum_memory_mb >= 25
    error_message = "Must specify at least 25Mb of memory"
  }
}

variable "monitoring_enabled" {
  description = "Whether to allow monitoring CRs to be deployed in the namespace"
  type        = bool
  default     = false
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}

variable "enhanced_ha_enabled" {
  description = "Whether to add extra high-availability scheduling constraints at the trade-off of increased cost"
  type        = bool
  default     = true
}

variable "voluntary_disruptions_enabled" {
  description = "Whether to enable voluntary disruptions of pods in this module."
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
  default     = 3600
  validation {
    condition     = var.voluntary_disruption_window_seconds >= 900
    error_message = "The disruption window must be at least 15 minutes to be effective."
  }
}

variable "voluntary_disruption_window_cron_schedule" {
  description = "The times when disruption windows should start"
  type        = string
  default     = "0 4 * * *"
}
