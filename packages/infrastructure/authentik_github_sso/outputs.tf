output "saml_metadata" {
  description = "The SAML metadata for the GitHub provider. https://en.wikipedia.org/wiki/SAML_metadata"
  value       = data.authentik_provider_saml_metadata.github.metadata
}

output "sso_post_url" {
  description = "The URL where SAML authentication requests are sent from the Service Provider (GitHub)"
  value       = authentik_provider_saml.github.url_sso_redirect
}

output "issuer_url" {
  description = "The Authentik issuer URL for the GitHub provider"
  value       = local.issuer
}

output "certificate" {
  description = "The certificate used to sign SAML responses"
  value       = authentik_certificate_key_pair.signing.certificate_data
}