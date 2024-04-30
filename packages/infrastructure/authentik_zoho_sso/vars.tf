variable "zoho_acs_url" {
  description = "The ACS url provided by Zoho when configuring an external identity provider"
  type        = string
}
variable "zoho_sign_in_url" {
  description = "The sign-in url provided by Zoho when configuring an external identity provider"
  type        = string
}

variable "zoho_issuer" {
  description = "The issuer provided by Zoho when configuring an external identity provider"
  type        = string
  default     = "zoho.com"
}

variable "authentik_domain" {
  description = "The domain name of the authentik instance"
  type        = string
}

variable "organization_name" {
  description = "The name of your organization"
  type        = string
}

variable "ui_description" {
  description = "The description to display in the Authentik web dashboard"
  type        = string
  default     = "Zoho"
}

variable "ui_group" {
  description = "The section in the Authentik web dashboard that this will appear in"
  type        = string
  default     = "Admin"
}

variable "allowed_groups" {
  description = "Only members of these groups can access AWS"
  type        = set(string)
  default     = []
}

variable "media_configmap" {
  description = "The configmap holding the static media that Authentik will use"
  type        = string
}

variable "authentik_namespace" {
  description = "The kubernetes namespace where Authentik is deployed"
  type        = string
}

