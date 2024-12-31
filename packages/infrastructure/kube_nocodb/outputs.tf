output "db_admin_role" {
  value = module.database.db_admin_role
}

output "db_superuser_role" {
  value = module.database.db_superuser_role
}

output "db_reader_role" {
  value = module.database.db_reader_role
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

output "superuser_email" {
  description = "The email for the superuser user."
  value       = var.superuser_email
}

output "superuser_password" {
  description = "The password for the superuser user."
  value       = random_password.superuser_password.result
  sensitive   = true
}

output "namespace" {
  description = "The name of the namespace where NocoDB will be deployed."
  value       = local.namespace
}

output "s3_bucket" {
  description = "The name of the S3 bucket where NocoDB will store attachments and other assets."
  value       = module.s3_bucket.bucket_name
}

output "domain" {
  value = var.domain
}

output "db_recovery_directory" {
  description = "The name of the directory in the backup bucket that contains the PostgreSQL backups and WAL archives"
  value       = module.database.recovery_directory
}
