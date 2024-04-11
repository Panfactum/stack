output "client_id" {
  description = "The client ID to provide to the auth/oidc auth method in Vault"
  value       = random_id.client_id.hex
}

output "client_secret" {
  description = "The client secret to provide the auth/oidc auth method in Vault"
  sensitive   = true
  value       = authentik_provider_oauth2.vault.client_secret
}

output "oidc_discovery_url" {
  description = "The OIDC discovery url to use for the auth/oidc auth method in Vault"
  value       = "https://${var.authentik_domain}/application/o/${var.vault_name}/"
}

output "oidc_redirect_uris" {
  description = "The redirect URIs to use for the auth/oidc auth method in Vault"
  value       = local.redirect_uris
}

output "oidc_issuer" {
  description = "The issuer to use for the auth/oidc auth method in Vault"
  value       = "https://${var.authentik_domain}/application/o/${var.vault_name}/"
}