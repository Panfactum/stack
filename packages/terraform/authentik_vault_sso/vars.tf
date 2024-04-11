variable "vault_name" {
  description = "The name of the vault instance. Must be unique in the Authentik system."
  type        = string
}

variable "vault_domain" {
  description = "The domain name of the Vault instance"
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

variable "ui_description" {
  description = "The description to display in the Authentik web dashboard"
  type        = string
  default     = "A Hashicorp Vault cluster"
}

variable "ui_group" {
  description = "The section in the Authentik web dashboard that this will appear in"
  type        = string
  default     = "Vault"
}

variable "allowed_groups" {
  description = "Only members of these groups can access AWS"
  type        = set(string)
  default     = []
}

