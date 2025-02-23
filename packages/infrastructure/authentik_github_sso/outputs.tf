output "saml_metadata" {
  description = "The SAML metadata for the Github provider"
  value       = data.authentik_provider_saml_metadata.mongodb_atlas.metadata
}

output "url_sso_post" {
  description = "The SSO POST URL for the Github provider"
  value       = authentik_provider_saml.github.url_sso_post
}

output "issuer_url" {
  description = "The Authentik issuer URL for the Github provider"
  value       = local.issuer
}