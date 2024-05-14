output "vault_urls" {
  value = [for domain in local.vault_domains : "https://${domain}"]
}

output "vault_domains" {
  value = local.vault_domains
}

output "vault_internal_url" {
  value = "http://vault-active.${local.namespace}.svc.cluster.local:8200"
}