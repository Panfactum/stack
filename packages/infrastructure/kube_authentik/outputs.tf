output "db_admin_role" {
  value = module.database.db_admin_role
}

output "db_superuser_role" {
  value = module.database.db_superuser_role
}

output "db_reader_role" {
  value = module.database.db_reader_role
}

output "db_superuser_username" {
  value = module.database.superuser_username
}

output "db_superuser_password" {
  value     = module.database.superuser_password
  sensitive = true
}

output "redis_admin_role" {
  value = module.redis.admin_role
}

output "redis_superuser_role" {
  value = module.redis.superuser_role
}

output "redis_reader_role" {
  value = module.redis.reader_role
}

output "akadmin_email" {
  description = "The email for the root akadmin user."
  value       = var.akadmin_email
}

output "akadmin_bootstrap_password" {
  description = "The initial password for the root akadmin user. Only used on initial bootstrapping."
  value       = random_password.bootstrap_password.result
  sensitive   = true
}

output "akadmin_bootstrap_token" {
  description = "The initial API token for the root akadmin user. Only used on initial bootstrapping."
  value       = random_password.bootstrap_token.result
  sensitive   = true
}


output "namespace" {
  value = local.namespace
}

output "email_templates_configmap" {
  value = kubernetes_config_map.email_templates.metadata[0].name
}

output "media_configmap" {
  value = kubernetes_config_map.media.metadata[0].name
}

output "domain" {
  value = var.domain
}

output "authentik_url" {
  value = "https://${var.domain}"
}