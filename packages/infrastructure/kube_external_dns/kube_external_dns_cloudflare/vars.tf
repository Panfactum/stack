variable "external_dns_helm_version" {
  description = "The version of the ExternalDNS helm chart to deploy"
  type        = string
  default     = "1.14.5"
}

variable "namespace" {
  description = "The namespace to deploy the ExternalDNS resources into"
  type        = string
}

variable "cloudflare_zones" {
  description = "A list of public DNS domain names managed by Cloudflare; external-dns uses this to set domain records"
  type = list(string)
  default = []
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
  default     = null
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "log_level" {
  description = "The log level for the ExternalDNS pods"
  type        = string
  default     = "warning"
  validation {
    condition     = contains(["info", "error", "fatal", "panic", "warning", "debug", "trace"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

