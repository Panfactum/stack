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

variable "disruptions_enabled" {
  description = "Whether temporary disruptions are allowed for the redis cluster"
  type        = bool
  default     = false
}

variable "persistence_enabled" {
  description = "Whether the redis data will be stored on disk"
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
  default     = 50

  validation {
    condition     = var.minimum_memory_mb >= 50
    error_message = "Must specify at least 50Mb of memory"
  }
}

variable "unsafe_tls_disabled" {
  description = "Whether to disable TLS encryption for the redis nodes. This flag is for internal use only and may be removed at any time."
  type        = bool
  default     = false
}
