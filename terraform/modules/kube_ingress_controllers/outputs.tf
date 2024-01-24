output "bastion_host_public_key" {
  value = tls_private_key.host.public_key_openssh
}
