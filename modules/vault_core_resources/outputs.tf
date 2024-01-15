output "vault_internal_pki_path" {
  value = vault_mount.pki_internal.path
}

output "vault_ssh_ca_public_key" {
  value = vault_ssh_secret_backend_ca.ssh.public_key
}
