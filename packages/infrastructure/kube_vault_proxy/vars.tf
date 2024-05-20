variable "oauth2_proxy_helm_version" {
  description = "The version of the descheduler helm chart to deploy"
  type        = string
  default     = "7.5.4"
}

variable "namespace" {
  description = "The namespace to deploy the proxy into"
  type        = string
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "domain" {
  description = "The domain the proxy is served from"
  type        = string
}

variable "vault_domain" {
  description = "The domain of the Vault instance running in the cluster."
  type        = string
}

variable "upstream_service_name" {
  description = "The name of the upstream service"
  type        = string
}

variable "allowed_email_domains" {
  description = "Email domains allowed to authenticate with the proxy"
  type        = list(string)
  default     = ["*"]
}