variable "core_dns_image_version" {
  description = "The version of the image to use for the deployment"
  type        = string
  default     = "1.11.1"
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

variable "service_ip" {
  description = "The IP address that the DNS service will be exposed on"
  type        = string
  default     = "172.20.0.10"
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}