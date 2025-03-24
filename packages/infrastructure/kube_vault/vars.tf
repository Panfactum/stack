variable "vault_helm_version" {
  description = "The version of the vault helm chart to deploy"
  type        = string
  default     = "0.27.0"
}

variable "vault_image_tag" {
  description = "The version of vault to use"
  type        = string
  default     = "1.14.7" // This is the last open source release
}

variable "vault_storage_size_gb" {
  description = "The number of gigabytes to allocate to vault storage."
  type        = number
  default     = 20
}

variable "vault_storage_limit_gb" {
  description = "The maximum number of gigabytes of storage to provision for the postgres cluster"
  type        = number
  default     = null
}

variable "vault_storage_increase_threshold_percent" {
  description = "Dropping below this percent of free storage will trigger an automatic increase in storage size"
  type        = number
  default     = 20
}

variable "vault_storage_increase_gb" {
  description = "The GB to increase storage by if free space drops below the threshold"
  type        = number
  default     = 1
}

variable "vault_domain" {
  description = "The public domain for the Vault cluster"
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "ingress_enabled" {
  description = "Whether or not to enable the ingress for routing traffic to vault"
  type        = bool
  default     = false
}

variable "cdn_mode_enabled" {
  description = "Whether to enable CDN mode for the Vault ingress"
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "monitoring_enabled" {
  description = "Whether to allow monitoring CRs to be deployed in the namespace"
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

variable "cors_enabled" {
  description = "Whether to enable CORS handling in the Vault ingress"
  type        = bool
  default     = false
}

variable "cors_extra_allowed_origins" {
  description = "Extra allowed origins for CORS handling"
  type        = list(string)
  default     = []
}

variable "node_image_cached_enabled" {
  description = "Whether to add the container images to the node image cache for faster startup times"
  type        = bool
  default     = true
}

variable "log_level" {
  description = "The log level for Vault pods. Must be one of: trace, debug, info, warn, error."
  type        = string
  default     = "warn"

  validation {
    condition     = contains(["trace", "debug", "info", "warn", "error"], var.log_level)
    error_message = "log_level must be one of: trace, debug, info, warn, error"
  }
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

################################################################################
## KMS Access
################################################################################

variable "superuser_iam_arns" {
  description = "List of IAM arns for encryption key superusers."
  type        = list(string)
  default     = []
}

variable "admin_iam_arns" {
  description = "List of IAM arns for encryption key admins."
  type        = list(string)
  default     = []
}

variable "reader_iam_arns" {
  description = "List of IAM arns for users who can use the encryption key for encryption and decryption."
  type        = list(string)
  default     = []
}

variable "restricted_reader_iam_arns" {
  description = "List of IAM arns for users who can only view the encryption key."
  type        = list(string)
  default     = []
}
