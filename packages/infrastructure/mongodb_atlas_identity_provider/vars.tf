variable "organization_id" {
  description = "ID of the MongoDB Atlas organization"
}

variable "federation_settings_id" {
  description = "The IDP ID from MongoDB Atlas"
}

variable "idp_id" {
  description = "The IDP ID from MongoDB Atlas"
}

variable "associated_domains" {
  type    = list(string)
  description = "The domains associated with the identity provider"
  default = []
}

variable "sso_debug_enabled" {
  description = "Enable SSO debug"
  default = true
}

variable "active" {
  type = bool
  description = "The status of the identity provider"
  default = false
}

variable "sso_url" {
  description = "The SSO URL"
}

variable "issuer_url" {
  description = "The issuer URL"
}

variable "name" {
  description = "The name of the identity provider"
  default = "Authentik Integration"
}

variable "member_groups" {
  description = "The group mappings for the identity provider"

  type        = list(string)
  default     = []
}