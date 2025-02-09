variable "media_configmap" {
  description = "The configmap holding the static media that Authentik will use"
  type        = string
}

variable "authentik_namespace" {
  description = "The kubernetes namespace where Authentik is deployed"
  type        = string
}

variable "authentik_domain" {
  description = "The domain name of the authentik instance"
  type        = string
}

variable "organization_name" {
  description = "The name of your organization"
  type        = string
}

variable "acs_url" {
  description = "The ACS url provided by Mongo Atlas when configuring an external identity provider"
  type        = string
}

variable "issuer" {
  description = "The authentik url of the idp"
  type        = string
}

variable "audience" {
  description = "The Entity URL provided by the Service Provider"
  type        = string
}

variable "ui_description" {
  description = "The description to display in the Authentik web dashboard"
  type        = string
  default     = "Atlas Mongo - SSO Login"
}

variable "allowed_groups" {
  description = "Only members of these groups can access MongoDB"
  type        = set(string)
  default     = [
    "superusers",
    "privileged_engineers",
    "engineers",
    "restricted_engineers",
    "billing_admins",
  ]
}