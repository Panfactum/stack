variable "vault_secrets_operator_helm_version" {
  description = "The version of the vault-secrets-operator helm chart to deploy"
  type        = string
  default     = "0.8.1"
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "vault_internal_url" {
  description = "The internal url of the vault instance"
  type        = string
}

variable "kubernetes_url" {
  description = "The url to the kubernetes API server"
  type        = string
}

variable "log_level" {
  description = "The log level for the vault-secrets-operators pods"
  type        = string
  default     = "error"
  validation {
    condition     = contains(["info", "error", "debug", "debug-extended", "trace"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
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
