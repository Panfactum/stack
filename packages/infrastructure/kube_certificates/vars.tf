variable "cert_manager_version" {
  description = "The version of cert-manager to deploy"
  type        = string
  default     = "1.16.3"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "log_verbosity" {
  description = "The log verbosity (0-9) for the cert-manager pods"
  type        = number
  default     = 0
}

variable "self_generated_certs_enabled" {
  description = "Whether to enable self-generated webhook certs (only use on initial installation)"
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

variable "canary_enabled" {
  description = "Whether to add canary checks to the deployed systems"
  type        = bool
  default     = false
}

variable "sla_target" {
  description = "The Panfactum SLA level for the module deployment. 1 = lowest uptime (99.9%), lowest cost -- 3 = highest uptime (99.999%), highest Cost"
  type        = number
  default     = 3

  validation {
    condition     = var.sla_target <= 3 && var.sla_target >= 1
    error_message = "sla_target must be one of: 1, 2, 3"
  }
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}

variable "wait" {
  description = "Wait for resources to be in a ready state before proceeding. Disabling this flag will allow upgrades to proceed faster but will disable automatic rollbacks. As a result, manual intervention may be required for deployment failures."
  type        = bool
  default     = true
}

variable "spot_nodes_enabled" {
  description = "Whether to allow pods to schedule on spot nodes"
  type        = bool
  default     = true
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow pods to schedule on burstable nodes"
  type        = bool
  default     = true
}

variable "controller_nodes_enabled" {
  description = "Whether to allow pods to schedule on EKS Node Group nodes (controller nodes)"
  type        = bool
  default     = true
}

variable "service_account" {
  description = "The name of the cert-manager service account."
  type        = string
  default     = "cert-manager"
}

variable "namespace" {
  description = "The name of the cert-manager namespace."
  type        = string
  default     = "cert-manager"
}

variable "route53_zones" {
  description = "A mapping of public DNS domains managed by AWS to their configuration; cert-manager uses this to issue public-facing certificates."
  type = map(object({
    record_manager_role_arn = string
    zone_id                 = string
  }))
  default = {}
}

variable "cloudflare_zones" {
  description = "A list of public DNS domains managed by Cloudflare; cert-manager uses this to issue public-facing certificates."
  type        = list(string)
  default     = []
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
  default     = null
}

variable "alert_email" {
  description = "An email that will receive certificate alerts."
  type        = string
}

variable "vault_internal_url" {
  description = "The url to the vault instance for internal cert issuance"
  type        = string
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "kube_domain" {
  description = "The domain under which cluster utilities have subdomains registered."
  type        = string
}
