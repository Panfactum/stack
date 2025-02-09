output "saml_metadata" {
  value = data.authentik_provider_saml_metadata.mongodb_atlas.metadata
}

output "url_sso_post" {
  value = authentik_provider_saml.mongodb_atlas.url_sso_post
}