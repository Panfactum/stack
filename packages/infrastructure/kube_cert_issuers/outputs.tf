output "vault_ca_crt" {
  description = "The public certificate of the root vault certificate authority"
  value       = vault_pki_secret_backend_root_cert.pki_internal.issuing_ca
}

output "route53_zones" {
  description = "The route53 zone configuration provided as an input"
  value       = var.route53_zones
}

output "cloudflare_zones" {
  description = "The cloudflare DNS names provided as an input"
  value       = var.cloudflare_zones
}