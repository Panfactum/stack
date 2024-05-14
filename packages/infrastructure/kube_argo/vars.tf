variable "argo_helm_version" {
  description = "The version of the argo helm chart to deploy"
  type        = string
  default     = "0.41.1"
}

variable "argo_image_tag" {
  description = "The version of argo to use"
  type        = string
  default     = "v3.5.6"
}

variable "environment_domains" {
  description = "The public domains on which the argo subdomain will be created for argo connectivity (e.g., the input `production.panfactum.com` will expose argo on `argo.production.panfactum.com`)."
  type        = list(string)
  validation {
    condition     = length(var.environment_domains) >= 1
    error_message = "Must specify at least one domain in environment_domains"
  }
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "ingress_enabled" {
  description = "Whether or not to enable the ingress for routing traffic to argo"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

