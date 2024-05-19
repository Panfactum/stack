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
  description = "How many GB to allocate for persistent storage"
  type        = number
  default     = 5
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


variable "persistence_enabled" {
  description = "Whether the redis data will be stored on disk"
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