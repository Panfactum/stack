variable "aws_acs_url" {
  description = "The ACS url provided by AWS when configuring and external identity provider"
  type        = string
}
variable "aws_sign_in_url" {
  description = "The Sign-in url provided by AWS when configuring and external identity provider"
  type        = string
}

variable "aws_issuer" {
  description = "The Issuer url provided by AWS when configuring and external identity provider"
  type        = string
}

variable "aws_scim_enabled" {
  description = "Whether to enable SCIM with AWS"
  type        = bool
  default     = false
}
variable "aws_scim_url" {
  description = "The SCIM endpoint provided by AWS"
  type        = string
  default     = ""
}

variable "aws_scim_token" {
  description = "The SCIM token provided by AWS"
  sensitive   = true
  type        = string
  default     = ""
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
  default     = "Amazon Web Services - IAM Identity Center SSO Login"
}

variable "ui_group" {
  description = "The section in the Authentik web dashboard that this will appear in"
  type        = string
  default     = "Amazon Web Services"
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

