output "db_admin_creds_secret" {
  value = module.database.admin_creds_secret
}

output "db_pooler_rw_service_name" {
  value = module.database.pooler_rw_service_name
}

output "db_pooler_rw_service_port" {
  value = module.database.pooler_rw_service_port
}