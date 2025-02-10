variable "mongodbatlas_public_key" {
  description = "The public key for the MongoDB Atlas API"
}

variable "mongodbatlas_private_key" {
  description = "The private key for the MongoDB Atlas API"
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