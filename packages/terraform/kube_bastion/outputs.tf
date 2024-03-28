output "bastion_host_public_key" {
  description = "The bastion host's public key for mutual verification"
  value       = tls_private_key.host.public_key_openssh
}

output "bastion_domains" {
  description = "The domains the SSH server is available on"
  value       = var.bastion_domains
}

output "bastion_port" {
  description = "The port the SSH server is available on in each domain"
  value       = var.bastion_port
  sensitive   = true
}
