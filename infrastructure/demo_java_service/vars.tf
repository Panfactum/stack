variable "domain" {
  description = "A list of domains from which the ingress will serve traffic"
  type        = string
}

variable "image_version" {
  description = "The version of the demo user service image to deploy"
  type        = string
}

variable "healthcheck_route" {
  description = "The route to use for the healthcheck"
  type        = string
}

variable "db_name" {
  description = "The name of the database"
  type        = string
}

variable "db_schema" {
  description = "The schema of the database"
  type        = string
}

variable "token_validation_url" {
  description = "The URL to use for token validation"
  type        = string
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "burstable_nodes_enabled" {
  description = "Whether to enable burstable nodes for the postgres cluster"
  type        = bool
  default     = true
}

variable "namespace" {
  description = "Kubernetes namespace to deploy the resources into"
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}

variable "enhanced_ha_enabled" {
  description = "Whether to add extra high-availability scheduling constraints at the trade-off of increased cost"
  type        = bool
  default     = true
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "pf_module_source" {
  description = "The source of the Panfactum modules"
  type        = string
}

variable "pf_module_ref" {
  description = "The reference of the Panfactum modules"
  type        = string
}