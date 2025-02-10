terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "1.26.1"
    }
  }
}

resource "mongodbatlas_federated_settings_identity_provider" "identity_provider" {
  federation_settings_id       = var.federation_settings_id
  name                         = var.name
  associated_domains           = var.associated_domains
  sso_debug_enabled            = var.sso_debug_enabled
  status                       = var.status
  sso_url                      = var.sso_url
  issuer_uri                   = var.issuer_url
  request_binding              = "HTTP-POST"
  response_signature_algorithm = "SHA-256"
}

data "mongodbatlas_federated_settings_identity_provider" "identity_provider_ds" {
  #federation_settings_id = mongodbatlas_federated_settings_identity_provider.identity_provider.id
  federation_settings_id = var.federation_settings_id
  identity_provider_id   = var.idp_id
}