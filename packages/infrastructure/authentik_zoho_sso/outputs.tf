output "saml_metadata" {
  value = data.authentik_provider_saml_metadata.zoho.metadata
}