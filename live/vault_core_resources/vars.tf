variable "vault_url" {
  description = "The url of the vault instance"
  type        = string
}

variable "vault_internal_url" {
  description = "The internal url of the vault instance"
  type        = string
}

variable "admin_groups" {
  description = "AAD groups that should have admin access to this vault trust domain"
  type        = list(string)
  default     = []
}

variable "reader_groups" {
  description = "AAD groups that should have read-only access to theis vault trust domain"
  type        = list(string)
  default     = []
}

variable "kubernetes_url" {
  description = "The url to the kubernetes API server"
  type        = string
}

variable "oidc_auth_token_lifetime_seconds" {
  description = "The lifetime of Vault tokens provisioned through OIDC auth method"
  type        = number
}

variable "ssh_cert_lifetime_seconds" {
  description = "The lifetime of SSH certs provisioned by Vault"
  type        = number
}
