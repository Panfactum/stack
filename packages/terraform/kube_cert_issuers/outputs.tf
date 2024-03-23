output "vault_ca_crt" {
  description = "The public certificate of the root vault certificate authority"
  value       = vault_pki_secret_backend_root_cert.pki_internal.issuing_ca
}