output "application_id" {
  value = azuread_application.oidc.application_id
}

output "application_object_id" {
  value = azuread_application.oidc.object_id
}

output "client_secret" {
  value     = azuread_application_password.oidc.value
  sensitive = true
}
