output "role_name" {
  description = "The name of the Vault auth role"
  value       = vault_kubernetes_auth_backend_role.role.role_name
}
