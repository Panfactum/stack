variable "client_id" {
  description = "The client id for the OIDC authentication"
  type        = string
}

variable "client_secret" {
  description = "The client secret for the OIDC authentication"
  type        = string
  sensitive   = true
}

variable "oidc_discovery_url" {
  description = "The discover url for OIDC authentication"
  type        = string
}

variable "token_lifetime_hours" {
  description = "Number of hours before generated tokens expire"
  type        = number
  default     = 12
}

variable "oidc_redirect_uris" {
  description = "The allowed redirect URIs for OIDC authentication"
  type        = list(string)
}

variable "oidc_issuer" {
  description = "The bound issuer for OIDC authentication to Vault"
  type        = string
}

variable "superuser_groups" {
  description = "Groups that should have superuser access to this Vault"
  type        = list(string)
  default     = []
}

variable "admin_groups" {
  description = "Groups that should have read and write access to this Vault"
  type        = list(string)
  default     = []
}

variable "reader_groups" {
  description = "Groups that should have read-only access to this Vault"
  type        = list(string)
  default     = []
}

variable "restricted_reader_groups" {
  description = "Groups that should have restricted read-only access to this Vault"
  type        = list(string)
  default     = []
}
