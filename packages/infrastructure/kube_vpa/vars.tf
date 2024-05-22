variable "vertical_autoscaler_helm_version" {
  description = "The version of VPA helm chart to deploy"
  type        = string
  default     = "4.4.5"
}

variable "vertical_autoscaler_image_version" {
  description = "The version of VPA image deploy"
  type        = string
  default     = "1.1.1"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "log_verbosity" {
  description = "The log verbosity (0-9) for the VPA pods"
  type        = number
  default     = 0
}

variable "prometheus_enabled" {
  description = "Whether to enable prometheus as the storage backend for the VPA recommender"
  type        = bool
  default     = false
}

variable "thanos_query_frontend_url" {
  description = "The address of the thanos query frontend to be used by the VPA recommender"
  type        = string
  default     = null
}

variable "history_length_hours" {
  description = "The number of prior hours of metrics data that will be used for VPA recommendations"
  type        = number
  default     = 24
}

variable "monitoring_enabled" {
  description = "Whether to allow monitoring CRs to be deployed in the namespace"
  type        = bool
  default     = true
}
