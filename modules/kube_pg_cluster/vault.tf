variable "vault_address" {
  description = "The address of the vault server."
  type        = string
}

variable "vault_token" {
  description = "The token for auth to the vault server."
  type        = string
}

provider "vault" {
  address = var.vault_address
  token   = var.vault_token
}
