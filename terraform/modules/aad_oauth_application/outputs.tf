output "application_id" {
  value = azuread_application.oauth.application_id
}

output "application_object_id" {
  value = azuread_application.oauth.object_id
}

output "client_secret" {
  value     = azuread_application_password.oauth.value
  sensitive = true
}
