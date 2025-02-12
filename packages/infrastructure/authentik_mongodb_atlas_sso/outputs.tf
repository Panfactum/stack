output "saml_metadata" {
  description = "The SAML metadata for the MongoDB Atlas provider"
  value = data.authentik_provider_saml_metadata.mongodb_atlas.metadata
}

output "url_sso_post" {
  description = "The SSO POST URL for the MongoDB Atlas provider"
  value = authentik_provider_saml.mongodb_atlas.url_sso_post
}

output "issuer_url" {
  description = "The Authentik issuer URL for the MongoDB Atlas provider"
  value = local.issuer
}