output "vault_url" {
  value = "https://${var.vault_domain}"
}

output "vault_domain" {
  value = var.vault_domain
}

output "vault_internal_url" {
  value = "http://vault-active.${local.namespace}.svc.cluster.local:8200"
}
