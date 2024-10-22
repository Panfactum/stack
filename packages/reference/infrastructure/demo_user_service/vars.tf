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

variable "secret" {
  description = "The secret to used for jwt validation"
  type        = string
}

variable "redis_cache_host" {
  description = "The host of the redis cache"
  type        = string
}

variable "redis_cache_port" {
  description = "The port of the redis cache"
  type        = number
}

variable "redis_master_set" {
  description = "The master set to use when configuring Sentinel-aware Redis clients"
  type        = string
}

variable "redis_cache_admin_role" {
  description = "The Vault role used to get admin credentials for the created Redis cluster"
  type        = string
}

variable "redis_cache_admin_creds_secret" {
  description = "The name of the Kubernetes Secret holding credentials for the admin role in the Redis database"
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

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
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