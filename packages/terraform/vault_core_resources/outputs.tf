output "vault_ssh_ca_public_key" {
  value = vault_ssh_secret_backend_ca.ssh.public_key
}
