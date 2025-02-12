output "acs_url" {
  value = data.mongodbatlas_federated_settings_identity_provider.identity_provider_ds.acs_url
}

output "audience" {
  value = data.mongodbatlas_federated_settings_identity_provider.identity_provider_ds.audience
}

output "audience_uri" {
  value = data.mongodbatlas_federated_settings_identity_provider.identity_provider_ds.audience_uri
}