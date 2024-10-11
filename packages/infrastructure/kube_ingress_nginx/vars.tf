variable "nginx_ingress_helm_version" {
  description = "The version of the nginx-ingress helm chart to deploy"
  type        = string
  default     = "4.10.0"
}

variable "max_replicas" {
  description = "The maximum number of nginx-ingress replicas to deploy"
  type        = number
  default     = 10
}

variable "min_replicas" {
  description = "The minimum number of nginx-ingress replicas to deploy"
  type        = number
  default     = 3
}

variable "dhparam" {
  description = "The Diffie-Hellman parameter to use for establishing perfect forward secrecy with TLS"
  type        = string
  sensitive   = true
}

variable "ingress_domains" {
  description = "The domains that can be used for network ingress to the cluster"
  type        = set(string)
}

variable "ingress_timeout_seconds" {
  description = "The maximum number of seconds that request may take."
  type        = number
  default     = 60
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "tls_1_2_enabled" {
  description = "Whether to enable TLS 1.2 protocols"
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
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


variable "enhanced_ha_enabled" {
  description = "Whether to add extra high-availability scheduling constraints at the trade-off of increased cost"
  type        = bool
  default     = true
}
