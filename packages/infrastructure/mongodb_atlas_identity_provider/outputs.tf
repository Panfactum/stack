output "acs_url" {
  description = "Assertion consumer service URL to which the IdP sends the SAML response"
  value       = data.mongodbatlas_federated_settings_identity_provider.identity_provider_ds.acs_url
}