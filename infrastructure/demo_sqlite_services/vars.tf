variable "statefulsets" {
  description = "The list of sqlite statefulsets to deploy"
  type = map(object({
    image_registry                     = string
    image_repository                   = string
    image_tag                          = string
    port                               = number
    domains                            = list(string)
    env                                = map(string)
    minimum_memory                     = optional(number, 100)
    healthcheck_route                  = optional(string, null)
    mount_path                         = string
    storage_class                      = optional(string, "ebs-standard")
    storage_initial_gb                 = optional(number, 1)
    storage_limit_gb                   = optional(number, null)
    storage_increase_threshold_percent = optional(number, 10)
    storage_increase_gb                = optional(number, 1)
    backups_enabled                    = optional(bool, false)
    cdn_mode_enabled                   = optional(bool, false)
    cors_enabled                       = optional(bool, false)
    cross_origin_embedder_policy       = optional(string, "credentialless")
    csp_enabled                        = optional(bool, false)
    cross_origin_isolation_enabled     = optional(bool, false)
    rate_limiting_enabled              = optional(bool, false)
    permissions_policy_enabled         = optional(bool, false)
  }))
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

variable "pf_module_source" {
  description = "The source of the Panfactum modules"
  type        = string
}

variable "pf_module_ref" {
  description = "The reference of the Panfactum modules"
  type        = string
}

