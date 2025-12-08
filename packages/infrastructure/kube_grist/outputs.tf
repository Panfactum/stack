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

output "root_email" {
  description = "The email for the superuser user."
  value       = var.root_email
}

output "namespace" {
  description = "The name of the namespace where NocoDB will be deployed."
  value       = local.namespace
}

# output "s3_bucket" {
#   description = "The name of the S3 bucket where NocoDB will store attachments and other assets."
#   value = module.s3_bucket.bucket_name
# }

output "domain" {
  value = var.domain
}


