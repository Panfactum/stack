variable "oauth2_proxy_helm_version" {
  description = "The version of the descheduler helm chart to deploy"
  type        = string
  default     = "7.8.1"
}

variable "namespace" {
  description = "The namespace to deploy the proxy into"
  type        = string
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "domain" {
  description = "The domain the proxy is served from"
  type        = string
}

variable "path_prefix" {
  description = "Path prefix for the ingress resource. Should be the same path prefix used by the upstream ingress resource."
  type        = string
  default     = "/"
  validation {
    condition     = can(regex("^/", var.path_prefix))
    error_message = "Path prefix must be a valid URI path, starting with \"/\"."
  }
}

variable "vault_domain" {
  description = "The domain of the Vault instance running in the cluster."
  type        = string
}

variable "allowed_email_domains" {
  description = "Email domains allowed to authenticate with the proxy"
  type        = list(string)
  default     = ["*"]
}

variable "allowed_vault_roles" {
  description = "Roles from Vault that are allowed to access the upstream resources"
  type        = set(string)
  default     = ["rbac-superusers", "rbac-admins", "rbac-readers", "rbac-restricted-readers"]
}

variable "instance_type_anti_affinity_required" {
  description = "Whether to enable anti-affinity to prevent pods from being scheduled on the same instance type"
  type        = bool
  default     = true
}

variable "az_spread_preferred" {
  description = "Whether to enable topology spread constraints to spread pods across availability zones (with ScheduleAnyways)"
  type        = bool
  default     = true
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "wait" {
  description = "Wait for resources to be in a ready state before proceeding. Disabling this flag will allow upgrades to proceed faster but will disable automatic rollbacks. As a result, manual intervention may be required for deployment failures."
  type        = bool
  default     = true
}
