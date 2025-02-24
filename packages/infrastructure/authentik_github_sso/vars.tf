variable "media_configmap" {
  description = "The ConfigMap holding the static media that Authentik will use"
  type        = string
  default     = "media"
}

variable "authentik_namespace" {
  description = "The kubernetes namespace where Authentik is deployed"
  type        = string
  default     = "authentik"
}

variable "authentik_domain" {
  description = "The domain name of the Authentik instance"
  type        = string
}

variable "organization_name" {
  description = "The name of your organization"
  type        = string
}

variable "acs_url" {
  description = "The ACS url provided by GitHub when configuring an external identity provider"
  type        = string
}

variable "audience" {
  description = "The Entity URL provided by the Service Provider"
  type        = string
  validation {
    condition     = can(regex("^((?!/sso).)*$", var.audience))
    error_message = "The audience must not contain '/sso'."
  }
}

variable "ui_description" {
  description = "The description to display in the Authentik web dashboard"
  type        = string
  default     = "GitHub"
}

variable "extra_allowed_groups" {
  description = "Additional groups that can access GitHub"
  type        = set(string)
  default     = []
}