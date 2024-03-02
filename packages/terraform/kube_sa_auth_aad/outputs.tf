output "client_id" {
  value = azuread_application.main.application_id
}

output "sp_object_id" {
  value = azuread_service_principal.main.object_id
}
